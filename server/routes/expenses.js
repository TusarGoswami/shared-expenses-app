const express = require('express');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { sequelize, Expense, ExpenseSplit, GroupMember, User } = require('../models');
const { convertToINR } = require('../services/currencyConverter');

const router = express.Router();

// Helper to format Expense response to match Mongoose populate('paidBy')
const formatExpense = (expense) => {
  if (!expense) return null;
  const json = expense.get({ plain: true });
  return {
    ...json,
    _id: json.id,
    paidBy: json.Payer ? { ...json.Payer, _id: json.Payer.id } : json.paidBy,
    Payer: undefined,
    splits: (json.splits || []).map((s) => ({
      ...s,
      _id: s.id,
      userId: s.User ? { ...s.User, _id: s.User.id } : s.userId,
      User: undefined,
    })),
  };
};

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
        const uId = member.userId && member.userId.id ? member.userId.id : member.userId;
        splits.push({ userId: uId, amount: share });
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

    const where = { groupId: req.params.id };

    // By default, exclude soft-deleted expenses
    if (includeDeleted !== 'true') {
      where.isDeleted = false;
    }

    if (paidBy) where.paidBy = paidBy;
    if (splitType) where.splitType = splitType;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
      order: [['date', 'DESC']],
    });

    const formattedExpenses = expenses.map(formatExpense);

    res.json({ expenses: formattedExpenses });
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

    // Scale splitDetails by exchangeRate (since splitDetails amounts are in the raw currency)
    const convertedSplitDetails = splitDetails?.map((d) => ({
      ...d,
      amount: d.amount !== undefined ? Number(d.amount) * exchangeRate : undefined,
    }));

    // Calculate splits (use amountInINR for split calculations)
    let splits;
    if (isSettlement) {
      // Settlement: direct transfer, splitDetails has the receiver
      if (!splitDetails || splitDetails.length === 0) {
        return res.status(400).json({
          message: 'Settlement requires splitDetails with receiver info',
        });
      }
      splits = convertedSplitDetails.map((d) => ({
        userId: d.userId,
        amount: d.amount,
      }));
    } else {
      splits = calculateSplits(splitType, amountInINR, convertedSplitDetails, activeMembers);
    }

    // Wrap in a transaction
    const expense = await sequelize.transaction(async (t) => {
      const exp = await Expense.create({
        groupId: req.params.id,
        description: description.trim(),
        amount: numericAmount,
        currency: curr,
        amountInINR,
        exchangeRateUsed: exchangeRate,
        date: expenseDate,
        paidBy,
        splitType,
        isSettlement: isSettlement || false,
        notes: notes?.trim() || '',
      }, { transaction: t });

      const splitRecords = splits.map((s) => ({
        expenseId: exp.id,
        userId: s.userId,
        amount: s.amount,
      }));

      await ExpenseSplit.bulkCreate(splitRecords, { transaction: t });

      return exp;
    });

    const populated = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    res.status(201).json({ expense: formatExpense(populated) });
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
      where: {
        id: req.params.expId,
        groupId: req.params.id,
      },
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
      const currentExchangeRate = updates.exchangeRateUsed ?? expense.exchangeRateUsed;
      const inputSplitDetails = updates.splitDetails || req.body.splitDetails;

      const convertedSplitDetails = inputSplitDetails?.map((d) => ({
        ...d,
        amount: d.amount !== undefined ? Number(d.amount) * currentExchangeRate : undefined,
      }));

      if (!updates.isSettlement && !expense.isSettlement) {
        updates.splits = calculateSplits(
          currentSplitType,
          currentAmountINR,
          convertedSplitDetails,
          activeMembers
        );
      } else {
        // For settlements, if splitDetails are updated, we need to update splits too!
        if (convertedSplitDetails && convertedSplitDetails.length > 0) {
          updates.splits = convertedSplitDetails.map((d) => ({
            userId: d.userId,
            amount: d.amount,
          }));
        }
      }
    }

    // Perform database operations within a transaction
    await sequelize.transaction(async (t) => {
      // Remove splitDetails from updates (not stored in schema)
      const splitsToCreate = updates.splits;
      delete updates.splitDetails;
      delete updates.splits;

      Object.assign(expense, updates);
      await expense.save({ transaction: t });

      if (splitsToCreate) {
        // Delete existing splits
        await ExpenseSplit.destroy({
          where: { expenseId: expense.id },
          transaction: t,
        });

        // Re-create splits
        const splitRecords = splitsToCreate.map((s) => ({
          expenseId: expense.id,
          userId: s.userId,
          amount: s.amount,
        }));
        await ExpenseSplit.bulkCreate(splitRecords, { transaction: t });
      }
    });

    const populated = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    res.json({ expense: formatExpense(populated) });
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
      where: {
        id: req.params.expId,
        groupId: req.params.id,
      },
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    expense.isDeleted = true;
    await expense.save();

    const populated = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    res.json({ message: 'Expense deleted', expense: formatExpense(populated) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
