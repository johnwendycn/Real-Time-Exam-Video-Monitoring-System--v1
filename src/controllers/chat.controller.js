const { ChatMessage, User } = require('../models');
const { Op } = require('sequelize');

class ChatController {
  async getRoomPublicHistory(req, res) {
    try {
      const { roomId } = req.params;
      
      const messages = await ChatMessage.findAll({
        where: {
          roomId,
          type: 'public'
        },
        include: [
          {
            model: User,
            as: 'Sender',
            attributes: ['id', 'username', 'role']
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      return res.status(200).json(messages);
    } catch (err) {
      console.error('[ChatController] Failed to fetch room public chat:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  async getPrivateHistory(req, res) {
    try {
      const { roomId, userId } = req.params;
      const currentUser = req.user;

      // Security check: Candidates can only fetch their own direct messages
      if (currentUser.role !== 'admin' && currentUser.id !== userId) {
        return res.status(403).json({ error: 'Unauthorized to view these direct messages.' });
      }

      // Fetch DMs scoped inside the room where either sender is target user OR receiver is target user
      const messages = await ChatMessage.findAll({
        where: {
          roomId,
          type: 'private',
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        include: [
          {
            model: User,
            as: 'Sender',
            attributes: ['id', 'username', 'role']
          },
          {
            model: User,
            as: 'Receiver',
            attributes: ['id', 'username', 'role']
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      return res.status(200).json(messages);
    } catch (err) {
      console.error('[ChatController] Failed to fetch private chat history:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new ChatController();
