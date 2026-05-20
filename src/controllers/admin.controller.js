const { ProctorLog, User } = require('../models');
const userService = require('../services/user.service');

class AdminController {
  async getLogs(req, res) {
    try {
      const logs = await ProctorLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 100
      });

      // Populate user names dynamically (or we can use Sequelize include, but we kept constraints loose for robustness)
      const populatedLogs = await Promise.all(
        logs.map(async (log) => {
          let targetUsername = 'System';
          let adminUsername = 'System';

          if (log.targetUserId) {
            const target = await User.findByPk(log.targetUserId);
            if (target) targetUsername = target.username;
          }

          if (log.adminUserId) {
            const admin = await User.findByPk(log.adminUserId);
            if (admin) adminUsername = admin.username;
          }

          return {
            id: log.id,
            action: log.action,
            targetUsername,
            adminUsername,
            details: log.details,
            createdAt: log.createdAt
          };
        })
      );

      return res.status(200).json(populatedLogs);
    } catch (err) {
      console.error('[AdminController] Failed to fetch logs:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  async getMetrics(req, res) {
    try {
      const allUsers = await User.count();
      const streamingUsers = await User.count({ where: { status: 'streaming' } });
      const onlineUsers = await User.count({ where: { status: 'online' } });
      const totalLogs = await ProctorLog.count();

      return res.status(200).json({
        totalUsers: allUsers,
        onlineUsers: onlineUsers + streamingUsers,
        streamingUsers,
        totalLogs,
        uptime: process.uptime()
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  async blockUser(req, res) {
    const { userId } = req.params;
    try {
      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      await userService.updateUserStatus(userId, 'blocked');

      // Add log
      await ProctorLog.create({
        action: 'USER_BLOCKED',
        targetUserId: userId,
        adminUserId: req.user.id,
        details: `Admin blocked user: ${user.username}`
      });

      return res.status(200).json({ success: true, message: 'User blocked successfully.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AdminController();
