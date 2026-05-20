const sequelize = require('../config/db.config');
const User = require('./user.model');
const ProctorLog = require('./log.model');
const Room = require('./room.model');
const ChatMessage = require('./message.model');

// Associations
ProctorLog.belongsTo(User, {
  as: 'TargetUser',
  foreignKey: 'targetUserId',
  constraints: false
});

ProctorLog.belongsTo(User, {
  as: 'AdminUser',
  foreignKey: 'adminUserId',
  constraints: false
});

ProctorLog.belongsTo(Room, {
  as: 'Room',
  foreignKey: 'roomId',
  constraints: false
});

User.belongsTo(Room, {
  as: 'CurrentRoom',
  foreignKey: 'currentRoomId',
  constraints: false
});

Room.hasMany(User, {
  as: 'ActiveUsers',
  foreignKey: 'currentRoomId',
  constraints: false
});

Room.belongsTo(User, {
  as: 'Creator',
  foreignKey: 'creatorId',
  constraints: false
});

ChatMessage.belongsTo(User, {
  as: 'Sender',
  foreignKey: 'senderId',
  constraints: false
});

ChatMessage.belongsTo(User, {
  as: 'Receiver',
  foreignKey: 'receiverId',
  constraints: false
});

ChatMessage.belongsTo(Room, {
  as: 'Room',
  foreignKey: 'roomId',
  constraints: false
});

Room.hasMany(ChatMessage, {
  as: 'Messages',
  foreignKey: 'roomId',
  constraints: false
});

const db = {
  sequelize,
  User,
  ProctorLog,
  Room,
  ChatMessage
};

module.exports = db;
