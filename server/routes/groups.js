const express = require('express');
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/groups — list all groups the logged-in user belongs to
// ---------------------------------------------------------------------------
router.get('/', auth, async (req, res, next) => {
  try {
    // Find all group memberships for this user
    const memberships = await GroupMember.find({ userId: req.user.userId });
    const groupIds = memberships.map((m) => m.groupId);

    const groups = await Group.find({ _id: { $in: groupIds } })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Attach member count and expense count to each group
    const Expense = require('../models/Expense');
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await GroupMember.countDocuments({
          groupId: group._id,
        });
        const expenseCount = await Expense.countDocuments({
          groupId: group._id,
          isDeleted: false,
        });
        return { ...group.toObject(), memberCount, expenseCount };
      })
    );

    res.json({ groups: groupsWithCounts });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups — create a new group
// ---------------------------------------------------------------------------
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.user.userId,
    });

    // Auto-add the creator as a member with today as join date
    await GroupMember.create({
      groupId: group._id,
      userId: req.user.userId,
      joinDate: new Date(),
      addedBy: req.user.userId,
    });

    const populated = await Group.findById(group._id).populate(
      'createdBy',
      'name email'
    );

    res.status(201).json({ group: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/groups/:id — get group detail with members
// ---------------------------------------------------------------------------
router.get('/:id', auth, async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).populate(
      'createdBy',
      'name email'
    );

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const members = await GroupMember.getAllMembers(group._id);

    res.json({ group, members });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:id — update group name/description
// ---------------------------------------------------------------------------
router.put('/:id', auth, async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();

    await group.save();

    res.json({ group });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/groups/:id/members — add a member to the group
// ---------------------------------------------------------------------------
router.post('/:id/members', auth, async (req, res, next) => {
  try {
    const { userId, email, name, joinDate } = req.body;

    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    let targetUserId = userId;

    // If userId not provided, look up by email or create a placeholder user
    if (!targetUserId && email) {
      let user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user && name) {
        // Create a user account (they can set password later)
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const tempHash = await bcrypt.hash('changeme123', salt);
        user = await User.create({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          passwordHash: tempHash,
        });
      }
      if (!user) {
        return res
          .status(400)
          .json({ message: 'Provide a valid userId or email (+ name) to add' });
      }
      targetUserId = user._id;
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'userId or email is required' });
    }

    // Check if already a member
    const existing = await GroupMember.findOne({
      groupId: group._id,
      userId: targetUserId,
    });
    if (existing) {
      return res.status(409).json({ message: 'User is already a member of this group' });
    }

    const member = await GroupMember.create({
      groupId: group._id,
      userId: targetUserId,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      addedBy: req.user.userId,
    });

    const populated = await GroupMember.findById(member._id).populate(
      'userId',
      'name email'
    );

    res.status(201).json({ member: populated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/groups/:id/members/:userId — update a member (e.g., set leaveDate)
// ---------------------------------------------------------------------------
router.put('/:id/members/:userId', auth, async (req, res, next) => {
  try {
    const { leaveDate, joinDate } = req.body;

    const member = await GroupMember.findOne({
      groupId: req.params.id,
      userId: req.params.userId,
    });

    if (!member) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    if (leaveDate !== undefined) {
      member.leaveDate = leaveDate ? new Date(leaveDate) : null;
    }
    if (joinDate !== undefined) {
      member.joinDate = new Date(joinDate);
    }

    await member.save();

    const populated = await GroupMember.findById(member._id).populate(
      'userId',
      'name email'
    );

    res.json({ member: populated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
