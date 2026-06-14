module.exports = (sequelize, DataTypes) => {
  const ImportLog = sequelize.define(
    'ImportLog',
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
      uploadedBy: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      fileName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      importedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      totalRows: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      successCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      errorCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      skippedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      parsedRows: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      isConfirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
    }
  );

  return ImportLog;
};
