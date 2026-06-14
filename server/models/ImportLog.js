const mongoose = require('mongoose');

const anomalyEntrySchema = new mongoose.Schema(
  {
    rowIndex: {
      type: Number,
      required: true,
    },
    issueType: {
      type: String,
      required: true,
      enum: [
        'DUPLICATE_ROW',
        'NEGATIVE_AMOUNT',
        'SETTLEMENT_AS_EXPENSE',
        'CURRENCY_MISMATCH',
        'DOLLAR_AS_RUPEE',
        'MEMBER_NOT_IN_GROUP',
        'EXPENSE_AFTER_LEAVE',
        'EXPENSE_BEFORE_JOIN',
        'MISSING_FIELDS',
        'INVALID_DATE',
        'PERCENTAGE_NOT_100',
        'EXACT_MISMATCH',
        'ZERO_AMOUNT',
        'NAME_VARIANT',
      ],
    },
    description: {
      type: String,
      required: true,
    },
    rawRow: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    suggestedAction: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
  },
  { _id: true }
);

const importLogSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: [true, 'Group ID is required'],
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    anomalies: [anomalyEntrySchema],

    // Parsed rows ready to be committed after user review
    parsedRows: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Whether the import has been finalised (confirmed by user)
    isConfirmed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ImportLog', importLogSchema);
