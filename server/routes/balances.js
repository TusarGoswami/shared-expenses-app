/**
 * Balance Routes
 * ==============
 * GET /api/groups/:id/balances           — Net balance per member
 * GET /api/groups/:id/balances/:userId   — Expense breakdown for one member
 * GET /api/groups/:id/settlements        — Suggested settlement transactions
 */

const express = require('express');
const auth = require('../middleware/auth');
const { Group, GroupMember, Expense, User, ExpenseSplit } = require('../models');
const { calculateBalances, getExpenseBreakdown } = require('../services/balanceCalculator');
const { suggestSettlements } = require('../services/settlementOptimizer');

const router = express.Router();

// Helper to map Sequelize expense instances to Mongoose-like shape for pure service functions
const mapToMongooseShape = (expense) => {
  if (!expense) return null;
  const plain = expense.get ? expense.get({ plain: true }) : expense;
  return {
    ...plain,
    _id: plain.id,
    paidBy: plain.Payer ? { ...plain.Payer, _id: plain.Payer.id } : plain.paidBy,
    splits: (plain.splits || []).map((s) => ({
      ...s,
      userId: s.User ? { ...s.User, _id: s.User.id } : s.userId,
    })),
  };
};

// Helper to map Sequelize group members to Mongoose-like shape for pure service functions
const mapMembersToMongooseShape = (members) => {
  return members.map((m) => {
    const plain = m.get ? m.get({ plain: true }) : m;
    return {
      ...plain,
      userId: plain.userId ? { ...plain.userId, _id: plain.userId.id } : plain.userId,
    };
  });
};

// ---------------------------------------------------------------------------
// GET /api/groups/:id/balances — Net balance for each member
// ---------------------------------------------------------------------------
router.get('/:id/balances', auth, async (req, res, next) => {
  try {
    const groupId = req.params.id;

    // Validate group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all members
    const members = await GroupMember.getAllMembers(groupId);

    // Fetch all expenses (non-deleted are included; isDeleted ones are
    // fetched too but calculateBalances will skip them internally)
    const expenses = await Expense.findAll({
      where: { groupId },
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    const mongooseExpenses = expenses.map(mapToMongooseShape);
    const mongooseMembers = mapMembersToMongooseShape(members);

    // Calculate balances
    const balances = calculateBalances(mongooseExpenses, mongooseMembers);

    // Convert to sorted array
    const balanceArray = Object.values(balances).sort(
      (a, b) => b.balance - a.balance
    );

    res.json({
      groupId,
      groupName: group.name,
      balances: balanceArray,
      totalExpenses: expenses.filter((e) => !e.isDeleted && !e.isSettlement).length,
      totalSettlements: expenses.filter((e) => !e.isDeleted && e.isSettlement).length,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id/balances/:userId — Expense breakdown for one member
// ---------------------------------------------------------------------------
router.get('/:id/balances/:userId', auth, async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const userId = req.params.userId;

    // Validate group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all expenses
    const expenses = await Expense.findAll({
      where: { groupId },
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    const mongooseExpenses = expenses.map(mapToMongooseShape);

    // Get the breakdown
    const breakdown = getExpenseBreakdown(mongooseExpenses, userId);

    // Also get the member info
    const member = await GroupMember.findOne({
      where: { groupId, userId },
      include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
    });

    const formattedMember = member ? {
      ...member.get({ plain: true }),
      userId: member.User,
      User: undefined,
    } : null;

    // Calculate the member's total summary
    let totalPaid = 0;
    let totalOwed = 0;
    for (const item of breakdown) {
      totalPaid += item.paidAmount;
      totalOwed += item.owedAmount;
    }

    res.json({
      groupId,
      userId,
      memberName: formattedMember?.userId?.name || 'Unknown',
      memberEmail: formattedMember?.userId?.email || '',
      netBalance: Math.round((totalPaid - totalOwed) * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOwed: Math.round(totalOwed * 100) / 100,
      expenseCount: breakdown.length,
      breakdown,
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id/settlements — Suggested settlement transactions
// ---------------------------------------------------------------------------
router.get('/:id/settlements', auth, async (req, res, next) => {
  try {
    const groupId = req.params.id;

    // Validate group exists
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all members
    const members = await GroupMember.getAllMembers(groupId);

    // Fetch all expenses
    const expenses = await Expense.findAll({
      where: { groupId },
      include: [
        { model: User, as: 'Payer', attributes: ['id', 'name', 'email'] },
        {
          model: ExpenseSplit,
          as: 'splits',
          include: [{ model: User, as: 'User', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });

    const mongooseExpenses = expenses.map(mapToMongooseShape);
    const mongooseMembers = mapMembersToMongooseShape(members);

    // Calculate balances
    const balances = calculateBalances(mongooseExpenses, mongooseMembers);

    // Generate settlement suggestions
    const settlements = suggestSettlements(balances);

    res.json({
      groupId,
      groupName: group.name,
      settlements,
      transactionCount: settlements.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
