/**
 * CSV Import Routes
 * =================
 * POST /api/groups/:id/import         — Upload CSV, parse, run anomaly detection, return report
 * POST /api/groups/:id/import/confirm — Receive user decisions on anomalies, commit approved rows
 * GET  /api/groups/:id/import/logs    — Get import history for a group
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { Group, GroupMember, Expense, ExpenseSplit, ImportLog, ImportAnomaly, User, sequelize } = require('../models');
const { parseAndAnalyzeCSV } = require('../services/csvImporter');
const { convertToINR } = require('../services/currencyConverter');
const { normalizeName } = require('../utils/nameNormalizer');

const router = express.Router();

// Helper to check if string is a valid UUID
const isUUID = (str) => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

// ---------------------------------------------------------------------------
// Multer configuration for CSV file uploads
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/import — Upload & Analyze CSV
// ---------------------------------------------------------------------------
router.post('/:id/import', auth, upload.single('csvFile'), async (req, res, next) => {
  try {
    const groupId = req.params.id;

    // Validate group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded. Use field name "csvFile".' });
    }

    // Read the uploaded CSV file
    const csvPath = req.file.path;
    const csvString = fs.readFileSync(csvPath, 'utf-8');

    // Run the CSV analyser with all 14 anomaly detectors
    const { parsedRows, anomalies, summary } = await parseAndAnalyzeCSV(
      csvString,
      groupId
    );

    // Create the ImportLog & ImportAnomaly entries inside a transaction
    const importLog = await sequelize.transaction(async (t) => {
      const log = await ImportLog.create({
        groupId,
        uploadedBy: req.user.userId,
        fileName: req.file.originalname,
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
        skippedCount: summary.skippedCount,
        parsedRows,
        isConfirmed: false,
      }, { transaction: t });

      if (anomalies && anomalies.length > 0) {
        const anomalyRecords = anomalies.map((a) => ({
          importLogId: log.id,
          rowIndex: a.rowIndex,
          issueType: a.issueType,
          description: a.description,
          rawRow: a.rawRow,
          suggestedAction: a.suggestedAction,
          status: a.status || 'pending',
        }));
        await ImportAnomaly.bulkCreate(anomalyRecords, { transaction: t });
      }

      return log;
    });

    // Load full log with created anomalies
    const populatedLog = await ImportLog.findByPk(importLog.id, {
      include: [{ model: ImportAnomaly, as: 'anomalies' }],
    });

    // Clean up the uploaded file (data is now in the database)
    try {
      fs.unlinkSync(csvPath);
    } catch (_e) {
      // Non-critical — file cleanup failure is acceptable
    }

    // Return the full import report for the frontend to display
    res.status(200).json({
      message: 'CSV parsed successfully. Review anomalies before confirming import.',
      importLogId: populatedLog.id,
      summary: {
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
        anomalyCount: populatedLog.anomalies.length,
        anomalyBreakdown: summary.anomalyBreakdown,
      },
      anomalies: populatedLog.anomalies.map((a) => ({
        id: a.id,
        _id: a.id, // preserve both formats for frontend
        rowIndex: a.rowIndex,
        issueType: a.issueType,
        description: a.description,
        rawRow: a.rawRow,
        suggestedAction: a.suggestedAction,
        status: a.status,
      })),
      parsedRows: populatedLog.parsedRows.map((r) => ({
        rowIndex: r.rowIndex,
        description: r.description,
        amount: r.amount,
        currency: r.currency,
        amountInINR: r.amountInINR,
        date: r.date,
        paidByName: r.paidByName,
        splitType: r.splitType,
        isSettlement: r.isSettlement,
        shouldSkip: r.shouldSkip,
        flags: r.flags,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/import/confirm — User approves/rejects anomalies
// ---------------------------------------------------------------------------
router.post('/:id/import/confirm', auth, async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const { importLogId, decisions } = req.body;

    if (!importLogId) {
      return res.status(400).json({ message: 'importLogId is required' });
    }

    // Find the import log
    const importLog = await ImportLog.findOne({
      where: {
        id: importLogId,
        groupId,
      },
      include: [{ model: ImportAnomaly, as: 'anomalies' }],
    });

    if (!importLog) {
      return res.status(404).json({ message: 'Import log not found' });
    }

    if (importLog.isConfirmed) {
      return res.status(400).json({ message: 'This import has already been confirmed' });
    }

    // -----------------------------------------------------------------------
    // Step 1: Apply user decisions to anomalies
    // -----------------------------------------------------------------------
    if (decisions && Array.isArray(decisions)) {
      for (const decision of decisions) {
        // Look up by id or _id in case the frontend sends MongoDB format
        const anomalyId = decision.anomalyId || decision._id;
        const anomaly = importLog.anomalies.find((a) => a.id === anomalyId);
        if (anomaly && ['approved', 'rejected'].includes(decision.status)) {
          anomaly.status = decision.status;
          await anomaly.save();
        }
      }
    }

    // Check for unresolved anomalies
    const unresolvedAnomalies = importLog.anomalies.filter(
      (a) => a.status === 'pending'
    );

    if (unresolvedAnomalies.length > 0) {
      return res.status(400).json({
        message: `${unresolvedAnomalies.length} anomaly(ies) still pending review. Resolve all before confirming.`,
        unresolvedCount: unresolvedAnomalies.length,
        unresolvedAnomalies: unresolvedAnomalies.map((a) => ({
          id: a.id,
          _id: a.id,
          rowIndex: a.rowIndex,
          issueType: a.issueType,
          description: a.description,
          status: a.status,
        })),
      });
    }

    // -----------------------------------------------------------------------
    // Step 2: Build the set of rejected row indices
    // -----------------------------------------------------------------------
    const rejectedRows = new Set();
    const skipAnomalyTypes = [
      'MISSING_FIELDS',
      'INVALID_DATE',
      'PERCENTAGE_NOT_100',
      'EXACT_MISMATCH',
    ];

    for (const anomaly of importLog.anomalies) {
      if (anomaly.status === 'rejected') {
        rejectedRows.add(anomaly.rowIndex);
      }
      if (
        skipAnomalyTypes.includes(anomaly.issueType) &&
        anomaly.status !== 'approved'
      ) {
        rejectedRows.add(anomaly.rowIndex);
      }
    }

    // Also check DUPLICATE_ROW rejections
    for (const anomaly of importLog.anomalies) {
      if (anomaly.issueType === 'DUPLICATE_ROW' && anomaly.status === 'rejected') {
        rejectedRows.add(anomaly.rowIndex);
      }
    }

    // -----------------------------------------------------------------------
    // Step 3: Fetch member map for userId resolution
    // -----------------------------------------------------------------------
    const members = await GroupMember.findAll({
      where: { groupId },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
    });
    const memberNameMap = new Map();
    for (const member of members) {
      if (!member.User) continue;
      memberNameMap.set(normalizeName(member.User.name), {
        userId: member.User.id,
        member,
      });
    }

    // -----------------------------------------------------------------------
    // Step 4: Commit approved rows as Expense documents
    // -----------------------------------------------------------------------
    let successCount = 0;
    let skippedCount = 0;
    const createdExpenses = [];
    const errors = [];

    for (const row of importLog.parsedRows) {
      // Skip rows that are flagged to skip or rejected by user
      if (row.shouldSkip || rejectedRows.has(row.rowIndex)) {
        skippedCount++;
        continue;
      }

      // Skip rows without essential data
      if (!row.paidBy || !row.date || row.amount === 0 && !row.flags?.zeroAmount) {
        skippedCount++;
        continue;
      }

      try {
        // Resolve paidBy userId
        let payerUserId = row.paidBy;

        // If paidBy is not a valid UUID, try to resolve by name
        if (typeof payerUserId === 'string' && !isUUID(payerUserId)) {
          const payerInfo = memberNameMap.get(normalizeName(row.paidByName || payerUserId));
          if (payerInfo) {
            payerUserId = payerInfo.userId;
          } else {
            errors.push({
              rowIndex: row.rowIndex,
              error: `Could not resolve payer "${row.paidByName}" to a group member`,
            });
            skippedCount++;
            continue;
          }
        }

        // Build splits
        let splits = [];
        const expenseDate = new Date(row.date);

        if (row.isSettlement) {
          // Settlement: use the split details as direct transfer
          if (row.splitDetails && row.splitDetails.length > 0) {
            splits = row.splitDetails.map((s) => ({
              userId: s.userId,
              amount: row.amountInINR,
            }));
          } else {
            // If no explicit receiver, skip — settlements need a receiver
            errors.push({
              rowIndex: row.rowIndex,
              error: 'Settlement has no receiver specified in split details',
            });
            skippedCount++;
            continue;
          }
        } else if (row.splitType === 'EQUAL') {
          let splitMembers = [];
          if (row.splitWith && row.splitWith.length > 0) {
            splitMembers = row.splitWith.filter(m => m.userId !== null);
          }

          if (splitMembers.length > 0) {
            const perPerson = Math.round((row.amountInINR / splitMembers.length) * 100) / 100;
            let remaining = row.amountInINR;
            splits = splitMembers.map((m, idx) => {
              const share = idx === splitMembers.length - 1
                ? Math.round(remaining * 100) / 100
                : perPerson;
              remaining -= share;
              return {
                userId: m.userId,
                amount: share,
              };
            });
          } else {
            // Get active members at expense date
            const activeMembers = await GroupMember.getActiveMembers(groupId, expenseDate);
            if (activeMembers.length === 0) {
              errors.push({
                rowIndex: row.rowIndex,
                error: 'No active members on expense date for EQUAL split',
              });
              skippedCount++;
              continue;
            }
            const perPerson = Math.round((row.amountInINR / activeMembers.length) * 100) / 100;
            let remaining = row.amountInINR;
            splits = activeMembers.map((m, idx) => {
              const share = idx === activeMembers.length - 1
                ? Math.round(remaining * 100) / 100
                : perPerson;
              remaining -= share;
              const uId = m.userId && m.userId.id ? m.userId.id : m.userId;
              return {
                userId: uId,
                amount: share,
              };
            });
          }
        } else if (row.splitType === 'EXACT' && row.splitDetails?.length > 0) {
          splits = row.splitDetails.map((s) => ({
            userId: s.userId,
            amount: Math.round((s.value * (row.exchangeRateUsed || 1)) * 100) / 100,
          }));
        } else if (row.splitType === 'PERCENTAGE' && row.splitDetails?.length > 0) {
          splits = row.splitDetails.map((s) => ({
            userId: s.userId,
            amount: Math.round((row.amountInINR * s.value / 100) * 100) / 100,
          }));
        } else if (row.splitType === 'SHARES' && row.splitDetails?.length > 0) {
          const totalShares = row.splitDetails.reduce((sum, s) => sum + s.value, 0);
          splits = row.splitDetails.map((s) => ({
            userId: s.userId,
            amount: Math.round((row.amountInINR * (s.value / totalShares)) * 100) / 100,
          }));
        } else {
          // Default to EQUAL split (checking split_with first)
          let splitMembers = [];
          if (row.splitWith && row.splitWith.length > 0) {
            splitMembers = row.splitWith.filter(m => m.userId !== null);
          }

          if (splitMembers.length > 0) {
            const perPerson = Math.round((row.amountInINR / splitMembers.length) * 100) / 100;
            let remaining = row.amountInINR;
            splits = splitMembers.map((m, idx) => {
              const share = idx === splitMembers.length - 1
                ? Math.round(remaining * 100) / 100
                : perPerson;
              remaining -= share;
              return {
                userId: m.userId,
                amount: share,
              };
            });
          } else {
            const activeMembers = await GroupMember.getActiveMembers(groupId, expenseDate);
            if (activeMembers.length === 0) {
              errors.push({
                rowIndex: row.rowIndex,
                error: 'No active members on expense date for default split',
              });
              skippedCount++;
              continue;
            }
            const perPerson = Math.round((row.amountInINR / activeMembers.length) * 100) / 100;
            let remaining = row.amountInINR;
            splits = activeMembers.map((m, idx) => {
              const share = idx === activeMembers.length - 1
                ? Math.round(remaining * 100) / 100
                : perPerson;
              remaining -= share;
              const uId = m.userId && m.userId.id ? m.userId.id : m.userId;
              return {
                userId: uId,
                amount: share,
              };
            });
          }
        }

        // Validate splits have at least one entry
        if (splits.length === 0) {
          errors.push({
            rowIndex: row.rowIndex,
            error: 'Could not compute splits for this expense',
          });
          skippedCount++;
          continue;
        }

        // Create the Expense & Splits within a database transaction
        const expense = await sequelize.transaction(async (t) => {
          const exp = await Expense.create({
            groupId,
            description: row.description || 'Imported expense',
            amount: row.amount,
            currency: row.currency || 'INR',
            amountInINR: row.amountInINR,
            exchangeRateUsed: row.exchangeRateUsed || 1,
            date: expenseDate,
            paidBy: payerUserId,
            splitType: row.splitType || 'EQUAL',
            isSettlement: row.isSettlement || false,
            isDeleted: false,
            importRowIndex: row.rowIndex,
            notes: row.notes || `Imported from CSV row ${row.rowIndex}`,
          }, { transaction: t });

          const splitRecords = splits.map((s) => ({
            expenseId: exp.id,
            userId: s.userId,
            amount: s.amount,
          }));

          await ExpenseSplit.bulkCreate(splitRecords, { transaction: t });

          return exp;
        });

        createdExpenses.push(expense.id);
        successCount++;
      } catch (err) {
        errors.push({
          rowIndex: row.rowIndex,
          error: err.message,
        });
        skippedCount++;
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Finalise the import log
    // -----------------------------------------------------------------------
    importLog.isConfirmed = true;
    importLog.successCount = successCount;
    importLog.skippedCount = skippedCount;
    importLog.errorCount = errors.length;
    await importLog.save();

    res.json({
      message: 'Import confirmed successfully',
      summary: {
        totalRows: importLog.totalRows,
        imported: successCount,
        skipped: skippedCount,
        errors: errors.length,
      },
      createdExpenseIds: createdExpenses,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id/import/logs — Import history
// ---------------------------------------------------------------------------
router.get('/:id/import/logs', auth, async (req, res, next) => {
  try {
    const logs = await ImportLog.findAll({
      where: { groupId: req.params.id },
      include: [{ model: User, as: 'Uploader', attributes: ['id', 'name', 'email'] }],
      order: [['importedAt', 'DESC']],
    });

    const formattedLogs = logs.map((log) => {
      const json = log.get({ plain: true });
      return {
        ...json,
        uploadedBy: json.Uploader || json.uploadedBy,
        Uploader: undefined,
      };
    });

    res.json({ logs: formattedLogs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
