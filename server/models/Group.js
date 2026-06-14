module.exports = (sequelize, DataTypes) => {
  const Group = sequelize.define(
    'Group',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          len: {
            args: [2, 100],
            msg: 'Group name must be between 2 and 100 characters',
          },
          notEmpty: { msg: 'Group name is required' },
        },
      },
      description: {
        type: DataTypes.STRING(500),
        defaultValue: '',
        validate: {
          len: {
            args: [0, 500],
            msg: 'Description must be at most 500 characters',
          },
        },
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
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

  return Group;
};
