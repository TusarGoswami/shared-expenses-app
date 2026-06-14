module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: {
            args: [2, 50],
            msg: 'Name must be at least 2 characters and at most 50 characters',
          },
          notEmpty: { msg: 'Name is required' },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          msg: 'Email address already in use',
        },
        validate: {
          isEmail: { msg: 'Please provide a valid email address' },
          notEmpty: { msg: 'Email is required' },
        },
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Password is required' },
        },
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      timestamps: true,
      updatedAt: false,
    }
  );

  // Customize toJSON to strip passwordHash from responses (Mongoose equivalent)
  User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  };

  return User;
};
