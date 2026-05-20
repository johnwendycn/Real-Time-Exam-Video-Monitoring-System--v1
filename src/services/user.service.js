const { User } = require('../models');

class UserService {
  async getAllUsers() {
    return await User.findAll({
      attributes: { exclude: ['password'] }
    });
  }

  async getActiveStreamingUsers() {
    return await User.findAll({
      where: { status: 'streaming' },
      attributes: { exclude: ['password'] }
    });
  }

  async getUserById(id) {
    return await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
  }

  async updateUserStatus(id, status) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('User not found.');
    }
    user.status = status;
    await user.save();
    return user;
  }

  async updateUserRoom(id, roomId) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('User not found.');
    }
    user.currentRoomId = roomId;
    await user.save();
    return user;
  }
}

module.exports = new UserService();
