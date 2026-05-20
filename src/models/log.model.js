const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ProctorLog = sequelize.define('ProctorLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  targetUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  adminUserId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = ProctorLog;
