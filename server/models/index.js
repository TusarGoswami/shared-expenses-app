const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // set to console.log if you want to debug queries
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Required for Neon cloud PostgreSQL
    },
  },
});

// Import model builder functions
const UserBuilder = require('./User');
const GroupBuilder = require('./Group');
const GroupMemberBuilder = require('./GroupMember');
const ExpenseBuilder = require('./Expense');
const ExpenseSplitBuilder = require('./ExpenseSplit');
const ImportLogBuilder = require('./ImportLog');
const ImportAnomalyBuilder = require('./ImportAnomaly');

// Initialize models
const User = UserBuilder(sequelize, DataTypes);
const Group = GroupBuilder(sequelize, DataTypes);
const GroupMember = GroupMemberBuilder(sequelize, DataTypes);
const Expense = ExpenseBuilder(sequelize, DataTypes);
const ExpenseSplit = ExpenseSplitBuilder(sequelize, DataTypes);
const ImportLog = ImportLogBuilder(sequelize, DataTypes);
const ImportAnomaly = ImportAnomalyBuilder(sequelize, DataTypes);

// --- Associations ---

// User <-> Group (Created by)
Group.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
User.hasMany(Group, { foreignKey: 'createdBy' });

// GroupMember associations
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(GroupMember, { foreignKey: 'groupId' });

// Use 'User' alias for User relation to avoid naming collision with column 'userId'
GroupMember.belongsTo(User, { as: 'User', foreignKey: 'userId' });
User.hasMany(GroupMember, { foreignKey: 'userId' });

GroupMember.belongsTo(User, { as: 'Adder', foreignKey: 'addedBy' });

// Expense associations
Expense.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(Expense, { foreignKey: 'groupId' });

Expense.belongsTo(User, { as: 'Payer', foreignKey: 'paidBy' });
User.hasMany(Expense, { foreignKey: 'paidBy' });

// Expense <-> ExpenseSplit
Expense.hasMany(ExpenseSplit, { as: 'splits', foreignKey: 'expenseId', onDelete: 'CASCADE' });
ExpenseSplit.belongsTo(Expense, { foreignKey: 'expenseId' });

// Use 'User' alias in ExpenseSplit to avoid naming collision with column 'userId'
ExpenseSplit.belongsTo(User, { as: 'User', foreignKey: 'userId' });
User.hasMany(ExpenseSplit, { foreignKey: 'userId' });

// ImportLog associations
ImportLog.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(ImportLog, { foreignKey: 'groupId' });

ImportLog.belongsTo(User, { as: 'Uploader', foreignKey: 'uploadedBy' });

ImportLog.hasMany(ImportAnomaly, { as: 'anomalies', foreignKey: 'importLogId', onDelete: 'CASCADE' });
ImportAnomaly.belongsTo(ImportLog, { foreignKey: 'importLogId' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  ImportLog,
  ImportAnomaly,
};
