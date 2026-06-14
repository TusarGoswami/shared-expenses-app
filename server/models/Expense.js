module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define(
    'Expense',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      groupId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(300),
        allowNull: false,
        validate: {
          len: {
            args: [1, 300],
            msg: 'Description must be between 1 and 300 characters',
          },
          notEmpty: { msg: 'Description is required' },
        },
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('amount');
          return rawValue === null ? null : parseFloat(rawValue);
        },
      },
      currency: {
        type: DataTypes.ENUM('INR', 'USD'),
        defaultValue: 'INR',
      },
      amountInINR: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('amountInINR');
          return rawValue === null ? null : parseFloat(rawValue);
        },
      },
      exchangeRateUsed: {
        type: DataTypes.DECIMAL(12, 4),
        defaultValue: 1.0,
        get() {
          const rawValue = this.getDataValue('exchangeRateUsed');
          return rawValue === null ? null : parseFloat(rawValue);
        },
      },
      date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      paidBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      splitType: {
        type: DataTypes.ENUM('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'),
        allowNull: false,
      },
      isSettlement: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      importRowIndex: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      notes: {
        type: DataTypes.STRING(500),
        defaultValue: '',
      },
    },
    {
      timestamps: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['groupId', 'isDeleted', 'date'],
        },
        {
          fields: ['groupId', 'paidBy'],
        },
      ],
    }
  );

  return Expense;
};
