const { DataTypes } = require('sequelize');
const sequelize = require('../config/db.config');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: true // Nullable for public room chat messages
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  messageText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('private', 'public'),
    defaultValue: 'private',
    allowNull: false
  }
}, {
  timestamps: true
});

module.exports = ChatMessage;
