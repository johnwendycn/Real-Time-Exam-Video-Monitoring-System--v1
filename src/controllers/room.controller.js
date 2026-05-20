const { Room, User, ProctorLog } = require('../models');

class RoomController {
  async createRoom(req, res) {
    try {
      const { name, passcode, maxParticipants } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Room name is required.' });
      }

      // Check if room name exists
      const existing = await Room.findOne({ where: { name } });
      if (existing) {
        return res.status(400).json({ error: 'Room name already exists.' });
      }

      // Validate capacity limit (1 to 100, default to 10)
      let parsedMax = parseInt(maxParticipants, 10);
      if (isNaN(parsedMax) || parsedMax < 1 || parsedMax > 100) {
        parsedMax = 10;
      }

      const room = await Room.create({
        name,
        passcode: passcode || null,
        maxParticipants: parsedMax,
        status: 'active',
        creatorId: req.user.id
      });

      // Log room creation
      await ProctorLog.create({
        action: 'ROOM_CREATED',
        adminUserId: req.user.id,
        roomId: room.id,
        details: `Admin created room: ${name} (Max Capacity: ${parsedMax} candidates)`
      });

      return res.status(201).json({
        success: true,
        message: 'Room created successfully.',
        room: {
          id: room.id,
          name: room.name,
          hasPasscode: !!room.passcode,
          maxParticipants: room.maxParticipants,
          status: room.status,
          createdAt: room.createdAt
        }
      });
    } catch (err) {
      console.error('[RoomController] Failed to create room:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  async getActiveRooms(req, res) {
    try {
      const rooms = await Room.findAll({
        where: { status: 'active' },
        order: [['createdAt', 'DESC']]
      });

      const formattedRooms = await Promise.all(rooms.map(async room => {
        const participantCount = await User.count({ where: { currentRoomId: room.id, role: 'user' } });
        return {
          id: room.id,
          name: room.name,
          hasPasscode: !!room.passcode,
          maxParticipants: room.maxParticipants,
          participantCount,
          status: room.status,
          createdAt: room.createdAt
        };
      }));

      return res.status(200).json(formattedRooms);
    } catch (err) {
      console.error('[RoomController] Failed to get active rooms:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  async deleteRoom(req, res) {
    try {
      const { roomId } = req.params;
      const room = await Room.findByPk(roomId);

      if (!room) {
        return res.status(404).json({ error: 'Room not found.' });
      }

      // Clear users currently inside this room
      await User.update({ currentRoomId: null }, { where: { currentRoomId: roomId } });

      await room.destroy();

      // Log room deletion
      await ProctorLog.create({
        action: 'ROOM_DELETED',
        adminUserId: req.user.id,
        details: `Admin deleted/closed room: ${room.name}`
      });

      return res.status(200).json({
        success: true,
        message: 'Room deleted/closed successfully.'
      });
    } catch (err) {
      console.error('[RoomController] Failed to delete room:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new RoomController();
