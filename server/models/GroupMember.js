const { Op } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const GroupMember = sequelize.define(
    'GroupMember',
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
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      joinDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      leaveDate: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      addedBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['groupId', 'userId'],
        },
      ],
    }
  );

  /**
   * Static method: find all members who were active on a given date.
   * A member is active if:
   *   joinDate <= date  AND  (leaveDate is null OR leaveDate >= date)
   */
  GroupMember.getActiveMembers = async function (groupId, date) {
    const queryDate = new Date(date);
    const members = await GroupMember.findAll({
      where: {
        groupId,
        joinDate: {
          [Op.lte]: queryDate,
        },
        [Op.or]: [
          { leaveDate: null },
          {
            leaveDate: {
              [Op.gte]: queryDate,
            },
          },
        ],
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'User',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return members.map((m) => {
      const json = m.get({ plain: true });
      const userObj = json.User || json.userId;
      return {
        ...json,
        _id: json.id,
        userId: userObj ? { ...userObj, _id: userObj.id } : undefined,
        User: undefined,
      };
    });
  };

  /**
   * Static method: get ALL members for a group (active + inactive).
   */
  GroupMember.getAllMembers = async function (groupId) {
    const members = await GroupMember.findAll({
      where: { groupId },
      include: [
        {
          model: sequelize.models.User,
          as: 'User',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    return members.map((m) => {
      const json = m.get({ plain: true });
      const userObj = json.User || json.userId;
      return {
        ...json,
        _id: json.id,
        userId: userObj ? { ...userObj, _id: userObj.id } : undefined,
        User: undefined,
      };
    });
  };

  return GroupMember;
};
