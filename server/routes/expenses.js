const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const GroupMember = require('../models/GroupMember');
const { convertToINR } = require('../services/currencyConverter');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: calculate splits based on split type
// ---------------------------------------------------------------------------
function calculateSplits(splitType, amount, splitDetails, activeMembers) {
  const splits = [];

  switch (splitType) {
    case 'EQUAL': {
      const perPerson = Math.round((amount / activeMembers.length) * 100) / 100;
      // Assign remainder to the first member to avoid rounding drift
      let remaining = amount;
      activeMembers.forEach((member, idx) => {
        const share = idx === activeMembers.length - 1
          ? Math.round(remaining * 100) / 100
          : perPerson;
        splits.push({ userId: member.userId._id || member.userId, amount: share });
        remaining -= share;
      });
      break;
    }

    case 'EXACT': {
      // splitDetails = [{ userId, amount }]
      if (!splitDetails || splitDetails.length === 0) {
        throw Object.assign(new Error('Exact split requires split details'), {
          statusCode: 400,
        });
      }
      const total = splitDetails.reduce((s, d) => s + Number(d.amount), 0);
      const diff = Math.abs(total - amount);
      if (diff > 0.01) {
        throw Object.assign(
          new Error(
            `Exact split amounts sum to ${total}, but expense total is ${amount} (difference: ${diff.toFixed(2)})`
          ),
          { statusCode: 400 }
        );
      }
      splitDetails.forEach((d) => {
        splits.push({ userId: d.userId, amount: Number(d.amount) });
      });
      break;
    }

    case 'PERCENTAGE': {
      // splitDetails = [{ userId, percentage }]
      if (!splitDetails || splitDetails.length === 0) {
        throw Object.assign(new Error('Percentage split requires split details'), {
          statusCode: 400,
        });
      }
      const totalPct = splitDetails.reduce((s, d) => s + Number(d.percentage), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw Object.assign(
          new Error(`Percentages sum to ${totalPct}, must equal 100`),
          { statusCode: 400 }
        );
      }
      splitDetails.forEach((d) => {
        const share = Math.round((amount * Number(d.percentage)) / 100 * 100) / 100;
        splits.push({ userId: d.userId, amount: share });
      });
      break;
    }

    case 'SHARES': {
      // splitDetails = [{ userId, shares }]
      if (!splitDetails || splitDetails.length === 0) {
        throw Object.assign(new Error('Shares split requires split details'), {
          statusCode: 400,
        });
      }
      const totalShares = splitDetails.reduce((s, d) => s + Number(d.shares), 0);
      if (totalShares === 0) {
        throw Object.assign(new Error('Total shares cannot be zero'), {
          statusCode: 400,
        });
      }
      splitDetails.forEach((d) => {
        const share =
          Math.round((amount * (Number(d.shares) / totalShares)) * 100) / 100;
        splits.push({ userId: d.userId, amount: share });
      });
      break;
    }

    default:
      throw Object.assign(new Error(`Invalid split type: ${splitType}`), {
        statusCode: 400,
      });
  }

  return splits;
}

// ---------------------------------------------------------------------------
// GET /api/groups/:id/expenses
// ---------------------------------------------------------------------------
router.get('/:id/expenses', auth, async (req, res, next) => {
  try {
    const { paidBy, splitType, startDate, endDate, includeDeleted } = req.query;

    const filter = { groupId: req.params.id };

    // By default, exclude soft-deleted expenses
    if (includeDeleted !== 'true') {
      filter.isDeleted = false;
    }

    if (paidBy) filter.paidBy = paidBy;
    if (splitType) filter.splitType = splitType;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email')
      .sort({ date: -1 });

    res.json({ expenses });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/expenses — create an expense
// ---------------------------------------------------------------------------
router.post('/:id/expenses', auth, async (req, res, next) => {
  try {
    const {
      description,
      amount,
      currency,
      date,
      paidBy,
      splitType,
      splitDetails,
      isSettlement,
      notes,
    } = req.body;

    // --- Validation ---
    if (!description || amount === undefined || !date || !paidBy || !splitType) {
      return res.status(400).json({
        message: 'description, amount, date, paidBy, and splitType are required',
      });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ message: 'Amount must be a valid number' });
    }

    // Currency conversion
    const curr = (currency || 'INR').toUpperCase();
    const { amountInINR, exchangeRate } = convertToINR(numericAmount, curr);

    const expenseDate = new Date(date);

    // Get active members on the expense date
    const activeMembers = await GroupMember.getActiveMembers(
      req.params.id,
      expenseDate
    );

    if (activeMembers.length === 0) {
      return res.status(400).json({
        message: 'No active members found on the expense date',
      });
    }

    // Calculate splits (use amountInINR for split calculations)
    let splits;
    if (isSettlement) {
      // Settlement: direct transfer, splitDetails has the receiver
      if (!splitDetails || splitDetails.length === 0) {
        return res.status(400).json({
          message: 'Settlement requires splitDetails with receiver info',
        });
      }
      splits = splitDetails.map((d) => ({
        userId: d.userId,
        amount: Number(d.amount),
      }));
    } else {
      splits = calculateSplits(splitType, amountInINR, splitDetails, activeMembers);
    }

    const expense = await Expense.create({
      groupId: req.params.id,
      description: description.trim(),
      amount: numericAmount,
      currency: curr,
      amountInINR,
      exchangeRateUsed: exchangeRate,
      date: expenseDate,
      paidBy,
      splitType,
      splits,
      isSettlement: isSettlement || false,
      notes: notes?.trim() || '',
    });

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email');

    res.status(201).json({ expense: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:id/expenses/:expId — update an expense
// ---------------------------------------------------------------------------
router.put('/:id/expenses/:expId', auth, async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.expId,
      groupId: req.params.id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const allowedFields = [
      'description',
      'amount',
      'currency',
      'date',
      'paidBy',
      'splitType',
      'splitDetails',
      'notes',
      'isSettlement',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // If amount or currency changed, recalculate INR
    if (updates.amount !== undefined || updates.currency !== undefined) {
      const amt = Number(updates.amount ?? expense.amount);
      const curr = (updates.currency ?? expense.currency).toUpperCase();
      const { amountInINR, exchangeRate } = convertToINR(amt, curr);
      updates.amountInINR = amountInINR;
      updates.exchangeRateUsed = exchangeRate;
      updates.amount = amt;
      updates.currency = curr;
    }

    // If splitType or amount changed and we have splitDetails, recalculate splits
    if (updates.splitDetails || updates.splitType || updates.amount !== undefined) {
      const expenseDate = updates.date ? new Date(updates.date) : expense.date;
      const activeMembers = await GroupMember.getActiveMembers(
        req.params.id,
        expenseDate
      );

      const currentAmountINR = updates.amountInINR ?? expense.amountInINR;
      const currentSplitType = updates.splitType ?? expense.splitType;

      if (!updates.isSettlement && !expense.isSettlement) {
        updates.splits = calculateSplits(
          currentSplitType,
          currentAmountINR,
          updates.splitDetails || req.body.splitDetails,
          activeMembers
        );
      }
    }

    // Remove splitDetails from updates (not stored in schema)
    delete updates.splitDetails;

    Object.assign(expense, updates);
    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email');

    res.json({ expense: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/groups/:id/expenses/:expId — soft delete
// ---------------------------------------------------------------------------
router.delete('/:id/expenses/:expId', auth, async (req, res, next) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.expId,
      groupId: req.params.id,
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.json({ message: 'Expense deleted', expense });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
