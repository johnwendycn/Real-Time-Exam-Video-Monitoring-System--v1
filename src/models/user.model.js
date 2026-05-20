const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 30]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('offline', 'online', 'streaming', 'blocked'),
    defaultValue: 'offline',
    allowNull: false
  },
  currentRoomId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = User;
