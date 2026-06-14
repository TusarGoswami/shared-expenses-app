module.exports = (sequelize, DataTypes) => {
  const ImportAnomaly = sequelize.define(
    'ImportAnomaly',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      importLogId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      rowIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      issueType: {
        type: DataTypes.ENUM(
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
          'NAME_VARIANT'
        ),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      rawRow: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
      },
      suggestedAction: {
        type: DataTypes.STRING,
        defaultValue: '',
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      },
    },
    {
      timestamps: false,
    }
  );

  return ImportAnomaly;
};
