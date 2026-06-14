module.exports = (sequelize, DataTypes) => {
  const ExpenseSplit = sequelize.define(
    'ExpenseSplit',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      expenseId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('amount');
          return rawValue === null ? null : parseFloat(rawValue);
        },
      },
    },
    {
      timestamps: false,
    }
  );

  return ExpenseSplit;
};
