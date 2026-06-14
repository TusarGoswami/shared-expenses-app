/**
 * Balance Routes
 * ==============
 * GET /api/groups/:id/balances           — Net balance per member
 * GET /api/groups/:id/balances/:userId   — Expense breakdown for one member
 * GET /api/groups/:id/settlements        — Suggested settlement transactions
 */

const express = require('express');
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const GroupMember = require('../models/GroupMember');
const Group = require('../models/Group');
const { calculateBalances, getExpenseBreakdown } = require('../services/balanceCalculator');
const { suggestSettlements } = require('../services/settlementOptimizer');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/groups/:id/balances — Net balance for each member
// ---------------------------------------------------------------------------
router.get('/:id/balances', auth, async (req, res, next) => {
  try {
    const groupId = req.params.id;

    // Validate group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all members
    const members = await GroupMember.getAllMembers(groupId);

    // Fetch all expenses (non-deleted are included; isDeleted ones are
    // fetched too but calculateBalances will skip them internally)
    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email');

    // Calculate balances
    const balances = calculateBalances(expenses, members);

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
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all expenses
    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email');

    // Get the breakdown
    const breakdown = getExpenseBreakdown(expenses, userId);

    // Also get the member info
    const member = await GroupMember.findOne({ groupId, userId }).populate(
      'userId',
      'name email'
    );

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
      memberName: member?.userId?.name || 'Unknown',
      memberEmail: member?.userId?.email || '',
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
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch all members
    const members = await GroupMember.getAllMembers(groupId);

    // Fetch all expenses
    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'name email')
      .populate('splits.userId', 'name email');

    // Calculate balances
    const balances = calculateBalances(expenses, members);

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
