const mongoose = require('mongoose');

const splitEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group ID is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [300, 'Description must be at most 300 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    currency: {
      type: String,
      enum: ['INR', 'USD'],
      default: 'INR',
    },
    amountInINR: {
      type: Number,
      required: [true, 'Amount in INR is required'],
    },
    exchangeRateUsed: {
      type: Number,
      default: 1,
    },
    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      index: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payer is required'],
    },
    splitType: {
      type: String,
      enum: ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'],
      required: [true, 'Split type is required'],
    },
    splits: {
      type: [splitEntrySchema],
      validate: {
        validator: function (arr) {
          return arr.length > 0;
        },
        message: 'At least one split entry is required',
      },
    },
    isSettlement: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    importRowIndex: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be at most 500 characters'],
      default: '',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

// Compound indexes for common queries
expenseSchema.index({ groupId: 1, isDeleted: 1, date: -1 });
expenseSchema.index({ groupId: 1, paidBy: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
