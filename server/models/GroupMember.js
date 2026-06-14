const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    joinDate: {
      type: Date,
      required: [true, 'Join date is required'],
    },
    leaveDate: {
      type: Date,
      default: null,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate memberships
groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

/**
 * Static method: find all members who were active on a given date.
 * A member is active if:
 *   joinDate <= date  AND  (leaveDate is null OR leaveDate >= date)
 */
groupMemberSchema.statics.getActiveMembers = async function (groupId, date) {
  const queryDate = new Date(date);
  return this.find({
    groupId,
    joinDate: { $lte: queryDate },
    $or: [{ leaveDate: null }, { leaveDate: { $gte: queryDate } }],
  }).populate('userId', 'name email');
};

/**
 * Static method: get ALL members for a group (active + inactive).
 */
groupMemberSchema.statics.getAllMembers = async function (groupId) {
  return this.find({ groupId }).populate('userId', 'name email');
};

module.exports = mongoose.model('GroupMember', groupMemberSchema);
