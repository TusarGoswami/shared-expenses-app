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
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const ImportLog = require('../models/ImportLog');
const User = require('../models/User');
const { parseAndAnalyzeCSV } = require('../services/csvImporter');
const { convertToINR } = require('../services/currencyConverter');
const { normalizeName } = require('../utils/nameNormalizer');

const router = express.Router();

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
    const group = await Group.findById(groupId);
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

    // Create the ImportLog document (not yet confirmed)
    const importLog = await ImportLog.create({
      groupId,
      uploadedBy: req.user.userId,
      fileName: req.file.originalname,
      totalRows: summary.totalRows,
      successCount: summary.successCount,
      errorCount: summary.errorCount,
      skippedCount: summary.skippedCount,
      anomalies,
      parsedRows,
      isConfirmed: false,
    });

    // Clean up the uploaded file (data is now in the ImportLog)
    try {
      fs.unlinkSync(csvPath);
    } catch (_e) {
      // Non-critical — file cleanup failure is acceptable
    }

    // Return the full import report for the frontend to display
    res.status(200).json({
      message: 'CSV parsed successfully. Review anomalies before confirming import.',
      importLogId: importLog._id,
      summary: {
        totalRows: summary.totalRows,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
        anomalyCount: anomalies.length,
        anomalyBreakdown: summary.anomalyBreakdown,
      },
      anomalies: importLog.anomalies.map((a) => ({
        _id: a._id,
        rowIndex: a.rowIndex,
        issueType: a.issueType,
        description: a.description,
        rawRow: a.rawRow,
        suggestedAction: a.suggestedAction,
        status: a.status,
      })),
      parsedRows: parsedRows.map((r, idx) => ({
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

    // decisions = [{ anomalyId: string, status: 'approved'|'rejected' }]

    if (!importLogId) {
      return res.status(400).json({ message: 'importLogId is required' });
    }

    // Find the import log
    const importLog = await ImportLog.findOne({
      _id: importLogId,
      groupId,
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
        const anomaly = importLog.anomalies.id(decision.anomalyId);
        if (anomaly && ['approved', 'rejected'].includes(decision.status)) {
          anomaly.status = decision.status;
        }
      }
    }

    // Check for unresolved anomalies
    const unresolvedAnomalies = importLog.anomalies.filter(
      (a) => a.status === 'pending'
    );

    if (unresolvedAnomalies.length > 0) {
      // Save partial decisions and tell the user to finish
      await importLog.save();
      return res.status(400).json({
        message: `${unresolvedAnomalies.length} anomaly(ies) still pending review. Resolve all before confirming.`,
        unresolvedCount: unresolvedAnomalies.length,
        unresolvedAnomalies: unresolvedAnomalies.map((a) => ({
          _id: a._id,
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

    // Collect rowIndices that have at least one REJECTED anomaly
    // and anomalies that result in skipping (MISSING_FIELDS, INVALID_DATE, etc.)
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
      // For hard-skip anomalies, always skip regardless of decision
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
    const members = await GroupMember.find({ groupId }).populate('userId', 'name email');
    const memberNameMap = new Map();
    for (const member of members) {
      if (!member.userId) continue;
      memberNameMap.set(normalizeName(member.userId.name), {
        userId: member.userId._id,
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

        // If paidBy is not a valid ObjectId, try to resolve by name
        if (typeof payerUserId === 'string' && payerUserId.length !== 24) {
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
              return {
                userId: m.userId._id || m.userId,
                amount: share,
              };
            });
          }
        } else if (row.splitType === 'EXACT' && row.splitDetails?.length > 0) {
          splits = row.splitDetails.map((s) => ({
            userId: s.userId,
            amount: s.value,
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
              return {
                userId: m.userId._id || m.userId,
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

        // Create the Expense document
        const expense = await Expense.create({
          groupId,
          description: row.description || 'Imported expense',
          amount: row.amount,
          currency: row.currency || 'INR',
          amountInINR: row.amountInINR,
          exchangeRateUsed: row.exchangeRateUsed || 1,
          date: expenseDate,
          paidBy: payerUserId,
          splitType: row.splitType || 'EQUAL',
          splits,
          isSettlement: row.isSettlement || false,
          isDeleted: false,
          importRowIndex: row.rowIndex,
          notes: row.notes || `Imported from CSV row ${row.rowIndex}`,
        });

        createdExpenses.push(expense._id);
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
    const logs = await ImportLog.find({ groupId: req.params.id })
      .populate('uploadedBy', 'name email')
      .sort({ importedAt: -1 });

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
