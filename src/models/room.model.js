const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  passcode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    allowNull: false
  },
  creatorId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  maxParticipants: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    allowNull: false,
    validate: {
      min: 1,
      max: 100
    }
  }
}, {
  timestamps: true
});

module.exports = Room;
