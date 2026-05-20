const { Server } = require('socket.io');
const authService = require('./auth.service');
const userService = require('./user.service');
const mediasoupService = require('./mediasoup.service');
const { ProctorLog, User, Room, ChatMessage } = require('../models');

class SocketService {
  constructor() {
    this.io = null;
    // Map of userId -> Set of socketIds (support multi-tab, though in proctoring we limit/track)
    this.userSockets = new Map();
    // Map of socketId -> User data
    this.socketUsers = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Authentication Middleware for Sockets
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication failed: Token is missing.'));
      }

      try {
        const decoded = authService.verifyToken(token);
        socket.user = decoded; // Attach user info to socket
        next();
      } catch (err) {
        return next(new Error(`Authentication failed: ${err.message}`));
      }
    });

    this.io.on('connection', async (socket) => {
      const user = socket.user;
      console.log(`[Socket] User connected: ${user.username} (${user.role}) - ID: ${socket.id}`);
      
      // Update in-memory collections
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id).add(socket.id);
      this.socketUsers.set(socket.id, user);

      // Join rooms
      socket.join(`user:${user.id}`);
      if (user.role === 'admin') {
        socket.join('admins');
        console.log(`[Socket] Admin ${user.username} joined admins channel.`);
      }

      // Update user status in database to 'online' (if not already streaming)
      try {
        const dbUser = await userService.getUserById(user.id);
        if (dbUser && dbUser.status !== 'streaming' && dbUser.status !== 'blocked') {
          await userService.updateUserStatus(user.id, 'online');
          this.notifyAdmins('user:status-changed', { userId: user.id, username: user.username, status: 'online' });
        }
      } catch (err) {
        console.error('[Socket] Failed to update user online status:', err.message);
      }

      // Tell newly connected user their setup is secure
      socket.emit('authorized', { user });

      // If newly connected is admin, broadcast current online status of all users to them
      if (user.role === 'admin') {
        this.sendActiveUsersState(socket);
      }

      // ----------------------------------------------------
      // ROOM SIGNALING EVENTS
      // ----------------------------------------------------
      socket.on('room:join', async ({ roomId, passcode }, callback) => {
        try {
          const room = await Room.findByPk(roomId);
          if (!room) {
            return callback({ error: 'Room not found.' });
          }

          if (room.status !== 'active') {
            return callback({ error: 'Room is inactive.' });
          }

          // Verify passcode if required
          if (room.passcode && user.role !== 'admin') {
            if (passcode !== room.passcode) {
              return callback({ error: 'Invalid room passcode.' });
            }
          }

          // Capacity constraint check for candidates (exclude active tab reconnects)
          if (user.role !== 'admin') {
            const dbUser = await userService.getUserById(user.id);
            if (dbUser && dbUser.currentRoomId !== roomId) {
              const participantCount = await User.count({ where: { currentRoomId: roomId, role: 'user' } });
              if (participantCount >= room.maxParticipants) {
                return callback({ error: `Room capacity reached. The maximum allowance is ${room.maxParticipants} candidates.` });
              }
            }
          }

          // If currently in another room, leave first
          if (socket.currentRoomId) {
            socket.leave(`room:${socket.currentRoomId}`);
            if (user.role === 'admin') {
              socket.leave(`room:admin:${socket.currentRoomId}`);
            } else {
              this.io.to(`room:admin:${socket.currentRoomId}`).emit('room:user-left', {
                userId: user.id,
                username: user.username
              });
            }
          }

          // Update currentRoomId in DB and socket
          await userService.updateUserRoom(user.id, roomId);
          socket.currentRoomId = roomId;

          // Join new room
          socket.join(`room:${roomId}`);
          
          if (user.role === 'admin') {
            socket.join(`room:admin:${roomId}`);
            console.log(`[Socket] Admin ${user.username} joined room admin channel for room: ${room.name}`);
            await this.sendRoomActiveUsersState(socket, roomId);
          } else {
            this.io.to(`room:admin:${roomId}`).emit('room:user-joined', {
              userId: user.id,
              username: user.username,
              status: user.status
            });

            await ProctorLog.create({
              action: 'ROOM_JOINED',
              targetUserId: user.id,
              roomId: room.id,
              details: `Candidate ${user.username} joined room: ${room.name}`
            });
          }

          // Fetch historical room public chat messages
          const publicHistory = await ChatMessage.findAll({
            where: { roomId, type: 'public' },
            include: [{ model: User, as: 'Sender', attributes: ['id', 'username', 'role'] }],
            order: [['createdAt', 'ASC']]
          });

          callback({ 
            success: true, 
            room: {
              id: room.id,
              name: room.name,
              status: room.status,
              maxParticipants: room.maxParticipants
            },
            publicHistory: publicHistory.map(msg => ({
              id: msg.id,
              senderId: msg.senderId,
              senderUsername: msg.Sender?.username || 'Unknown',
              messageText: msg.messageText,
              timestamp: msg.createdAt
            }))
          });
        } catch (err) {
          console.error('[Socket Error] room:join:', err.message);
          callback({ error: err.message });
        }
      });

      socket.on('room:leave', async (data, callback) => {
        try {
          const roomId = socket.currentRoomId;
          if (!roomId) {
            return callback({ success: true });
          }

          await userService.updateUserRoom(user.id, null);
          socket.currentRoomId = null;

          socket.leave(`room:${roomId}`);
          
          if (user.role === 'admin') {
            socket.leave(`room:admin:${roomId}`);
            // Clean up admin's mediasoup transports/consumers so re-login starts fresh
            mediasoupService.cleanupUser(user.id);
          } else {
            this.io.to(`room:admin:${roomId}`).emit('room:user-left', {
              userId: user.id,
              username: user.username
            });

            const { Room } = require('../models');
            const room = await Room.findByPk(roomId);
            await ProctorLog.create({
              action: 'ROOM_LEFT',
              targetUserId: user.id,
              roomId: roomId,
              details: `Candidate ${user.username} left room: ${room ? room.name : roomId}`
            });

            mediasoupService.cleanupUser(user.id);
            
            const dbUser = await userService.getUserById(user.id);
            if (dbUser && dbUser.status !== 'blocked') {
              await userService.updateUserStatus(user.id, 'online');
              this.io.to(`room:admin:${roomId}`).emit('user:status-changed', {
                userId: user.id,
                username: user.username,
                status: 'online'
              });
              this.notifyAdmins('user:status-changed', { userId: user.id, username: user.username, status: 'online' });
            }
          }

          callback({ success: true });
        } catch (err) {
          console.error('[Socket Error] room:leave:', err.message);
          callback({ error: err.message });
        }
      });

      // ----------------------------------------------------
      // MEDIASOUP SIGNALING EVENTS
      // ----------------------------------------------------

      // 1. Get Router RTP Capabilities
      socket.on('getRouterRtpCapabilities', (data, callback) => {
        try {
          const router = mediasoupService.getOrCreateUserRouter(user.id);
          callback({ rtpCapabilities: router.rtpCapabilities });
        } catch (err) {
          console.error('[Socket Mediasoup Error] getRouterRtpCapabilities:', err.message);
          callback({ error: err.message });
        }
      });

      // 2. Create WebRTC Transport
      socket.on('createWebRtcTransport', async (data, callback) => {
        try {
          // If consuming, admin can create transport on their own router
          const transportParams = await mediasoupService.createWebRtcTransport(user.id);
          callback(transportParams);
        } catch (err) {
          console.error('[Socket Mediasoup Error] createWebRtcTransport:', err.message);
          callback({ error: err.message });
        }
      });

      // 3. Connect WebRTC Transport
      socket.on('connectWebRtcTransport', async ({ transportId, dtlsParameters }, callback) => {
        try {
          await mediasoupService.connectTransport(transportId, dtlsParameters);
          callback({ success: true });
        } catch (err) {
          console.error('[Socket Mediasoup Error] connectWebRtcTransport:', err.message);
          callback({ error: err.message });
        }
      });

      // 4. Produce stream (User only)
      socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
        try {
          // Strict Security Check: Admin doesn't stream, users only
          const producerInfo = await mediasoupService.createProducer(user.id, transportId, kind, rtpParameters);
          
          // Mark user status as streaming in the database
          await userService.updateUserStatus(user.id, 'streaming');

          // Broadcast to admins that a new stream has started
          const statusPayload = { 
            userId: user.id, 
            username: user.username, 
            status: 'streaming',
            producerId: producerInfo.id,
            kind: kind
          };

          if (socket.currentRoomId) {
            this.io.to(`room:admin:${socket.currentRoomId}`).emit('user:status-changed', statusPayload);
          }
          this.notifyAdmins('user:status-changed', statusPayload);

          callback({ id: producerInfo.id });
        } catch (err) {
          console.error('[Socket Mediasoup Error] produce:', err.message);
          callback({ error: err.message });
        }
      });

      // 5. Consume stream (Admin only sees users, users can only consume themselves if they want)
      socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities, targetUserId }, callback) => {
        try {
          // SECURITY RULE: Users can only consume their own producers, Admin can consume anyone in their room
          if (user.role !== 'admin' && user.id !== targetUserId) {
            return callback({ error: 'Unauthorized: Users cannot consume streams of other users.' });
          }

          if (user.role === 'admin') {
            const targetUser = await userService.getUserById(targetUserId);
            if (!targetUser || targetUser.currentRoomId !== socket.currentRoomId) {
              return callback({ error: 'Unauthorized: Cannot monitor candidates outside your active room.' });
            }
          }

          const consumerParams = await mediasoupService.createConsumer(
            user.id, 
            consumerTransportId, 
            producerId, 
            rtpCapabilities
          );

          callback(consumerParams);
        } catch (err) {
          console.error('[Socket Mediasoup Error] consume:', err.message);
          callback({ error: err.message });
        }
      });

      // 6. Resume Consumer
      socket.on('resumeConsumer', ({ consumerId }, callback) => {
        try {
          mediasoupService.resumeConsumer(consumerId);
          callback({ success: true });
        } catch (err) {
          console.error('[Socket Mediasoup Error] resumeConsumer:', err.message);
          callback({ error: err.message });
        }
      });

      // ----------------------------------------------------
      // DIRECT CONTROL & SECURITY COMMANDS (ADMIN ONLY)
      // ----------------------------------------------------

      // Toggle user's producer (Mute Audio / Pause Video) at SFU level
      socket.on('admin:toggle-producer', async ({ targetUserId, producerId, pause, actionType }, callback) => {
        try {
          if (user.role !== 'admin') {
            return callback({ error: 'Unauthorized: Admin privileges required.' });
          }

          if (pause) {
            mediasoupService.pauseProducer(producerId);
          } else {
            mediasoupService.resumeProducer(producerId);
          }

          // Create an audit trail log
          const logText = pause ? `Admin paused user ${actionType} feed` : `Admin resumed user ${actionType} feed`;
          
          const targetUser = await User.findByPk(targetUserId);
          const roomId = targetUser?.currentRoomId;

          await ProctorLog.create({
            action: pause ? 'MEDIA_PAUSED' : 'MEDIA_RESUMED',
            targetUserId,
            adminUserId: user.id,
            roomId: roomId || null,
            details: JSON.stringify({ producerId, actionType, text: logText })
          });

          // Notify the target user's socket directly
          this.io.to(`user:${targetUserId}`).emit('stream:toggled', { 
            producerId, 
            paused: pause, 
            actionType 
          });

          const logPayload = {
            action: pause ? 'MEDIA_PAUSED' : 'MEDIA_RESUMED',
            targetUsername: targetUser?.username,
            adminUsername: user.username,
            timestamp: new Date(),
            details: logText
          };

          // Broadcast status refresh to admins
          if (roomId) {
            this.io.to(`room:admin:${roomId}`).emit('proctor:log-added', logPayload);
          }
          this.notifyAdmins('proctor:log-added', logPayload);

          callback({ success: true });
        } catch (err) {
          console.error('[Socket Admin Command Error] toggle-producer:', err.message);
          callback({ error: err.message });
        }
      });

      // Force Kick User (Admin kicks student)
      socket.on('admin:kick-user', async ({ targetUserId, reason }, callback) => {
        try {
          if (user.role !== 'admin') {
            return callback({ error: 'Unauthorized: Admin privileges required.' });
          }

          console.log(`[Socket Admin Action] Admin ${user.username} is kicking user ${targetUserId}. Reason: ${reason}`);

          const targetUser = await User.findByPk(targetUserId);
          const roomId = targetUser?.currentRoomId;

          // Create Audit Log
          await ProctorLog.create({
            action: 'USER_KICKED',
            targetUserId,
            adminUserId: user.id,
            roomId: roomId || null,
            details: JSON.stringify({ reason })
          });

          // Send direct signal to the user to disconnect
          this.io.to(`user:${targetUserId}`).emit('proctor:kicked', { reason });

          // Force close their sockets
          const targetSockets = this.userSockets.get(targetUserId);
          if (targetSockets) {
            for (const socketId of targetSockets) {
              const s = this.io.sockets.sockets.get(socketId);
              if (s) {
                s.disconnect(true);
              }
            }
          }

          const logPayload = {
            action: 'USER_KICKED',
            targetUsername: targetUser?.username,
            adminUsername: user.username,
            timestamp: new Date(),
            details: `Kicked user. Reason: ${reason}`
          };

          // Broadcast status refresh to admins
          if (roomId) {
            this.io.to(`room:admin:${roomId}`).emit('proctor:log-added', logPayload);
            this.io.to(`room:admin:${roomId}`).emit('room:user-left', {
              userId: targetUserId,
              username: targetUser?.username
            });
          }
          this.notifyAdmins('proctor:log-added', logPayload);

          callback({ success: true });
        } catch (err) {
          console.error('[Socket Admin Command Error] kick-user:', err.message);
          callback({ error: err.message });
        }
      });

      // ----------------------------------------------------
      // CHAT & COMMUNICATIONS
      // ----------------------------------------------------

      // Chat message routing and database persistence (both public & private)
      socket.on('chat:send-message', async ({ receiverId, messageText }, callback) => {
        try {
          const roomId = socket.currentRoomId;
          if (!roomId) {
            return callback({ error: 'You are not currently in any room.' });
          }

          if (receiverId === 'public') {
            // 1. PUBLIC ROOM CHAT
            const chatMsg = await ChatMessage.create({
              senderId: user.id,
              receiverId: null,
              roomId,
              messageText,
              type: 'public'
            });

            const msgPayload = {
              id: chatMsg.id,
              senderId: user.id,
              senderUsername: user.username,
              messageText,
              timestamp: chatMsg.createdAt,
              type: 'public'
            };

            // Broadcast public message to all participants in the room
            this.io.to(`room:${roomId}`).emit('chat:receive-message', msgPayload);

            return callback({ success: true, timestamp: chatMsg.createdAt });
          } else {
            // 2. PRIVATE DIRECT MESSAGE (DM)
            let actualReceiverId = receiverId;
            if (receiverId === 'admin') {
              const room = await Room.findByPk(roomId);
              if (room) {
                actualReceiverId = room.creatorId;
              } else {
                return callback({ error: 'Active room not found.' });
              }
            }

            const chatMsg = await ChatMessage.create({
              senderId: user.id,
              receiverId: actualReceiverId,
              roomId,
              messageText,
              type: 'private'
            });

            const msgPayload = {
              id: chatMsg.id,
              senderId: user.id,
              senderUsername: user.username,
              receiverId: actualReceiverId,
              messageText,
              timestamp: chatMsg.createdAt,
              type: 'private'
            };

            // Route private message:
            if (receiverId === 'admin') {
              // From candidate to proctor - notify the room admin channel
              this.io.to(`room:admin:${roomId}`).emit('chat:receive-message', msgPayload);
            } else {
              // From proctor/candidate to a specific user
              const receiverSockets = this.userSockets.get(actualReceiverId);
              if (receiverSockets) {
                for (const socketId of receiverSockets) {
                  this.io.to(socketId).emit('chat:receive-message', msgPayload);
                }
              }
            }

            // Sync with sender's other sockets (multi-tab sync)
            socket.to(`user:${user.id}`).emit('chat:receive-message', msgPayload);

            return callback({ success: true, timestamp: chatMsg.createdAt });
          }
        } catch (err) {
          console.error('[Socket Chat Error]:', err.message);
          callback({ error: err.message });
        }
      });

      // ----------------------------------------------------
      // DISCONNECT HANDLING
      // ----------------------------------------------------
      socket.on('disconnect', async (reason) => {
        console.log(`[Socket] Socket disconnected: ${socket.id}. Reason: ${reason}`);
        
        // Remove specific socket
        const socketSet = this.userSockets.get(user.id);
        if (socketSet) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            this.userSockets.delete(user.id);
            
            // All tabs closed for this user - mark offline and clean up media streams!
            try {
              const dbUser = await userService.getUserById(user.id);
              if (dbUser && dbUser.status !== 'blocked') {
                await userService.updateUserStatus(user.id, 'offline');

                // If they were in a room, notify room admins
                const roomId = dbUser.currentRoomId;
                if (roomId) {
                  this.io.to(`room:admin:${roomId}`).emit('room:user-left', {
                    userId: user.id,
                    username: user.username
                  });
                  this.io.to(`room:admin:${roomId}`).emit('user:status-changed', {
                    userId: user.id,
                    username: user.username,
                    status: 'offline'
                  });
                  await userService.updateUserRoom(user.id, null);
                }

                this.notifyAdmins('user:status-changed', { userId: user.id, username: user.username, status: 'offline' });
              }

              // Free SFU resources
              mediasoupService.cleanupUser(user.id);
            } catch (err) {
              console.error('[Socket Disconnect Error] Failed during database user offline status or mediasoup cleanup:', err.message);
            }
          }
        }
        
        this.socketUsers.delete(socket.id);
      });
    });
  }

  notifyAdmins(event, payload) {
    if (this.io) {
      this.io.to('admins').emit(event, payload);
    }
  }

  async sendActiveUsersState(socket) {
    try {
      const allUsers = await userService.getAllUsers();
      const userStates = allUsers
        .filter(u => u.role !== 'admin')
        .map(u => {
          const producers = mediasoupService.userProducersMap.get(u.id);
          return {
            id: u.id,
            username: u.username,
            email: u.email,
            status: u.status,
            producerIds: producers ? Array.from(producers) : []
          };
        });
      
      socket.emit('admin:init-state', { users: userStates });
    } catch (err) {
      console.error('[Socket] Failed to send active state to admin:', err.message);
    }
  }

  async sendRoomActiveUsersState(socket, roomId) {
    try {
      const roomUsers = await User.findAll({
        where: { currentRoomId: roomId },
        attributes: { exclude: ['password'] }
      });

      const userStates = roomUsers
        .filter(u => u.role !== 'admin')
        .map(u => {
          const producers = mediasoupService.userProducersMap.get(u.id);
          return {
            id: u.id,
            username: u.username,
            email: u.email,
            status: u.status,
            producerIds: producers ? Array.from(producers) : []
          };
        });

      socket.emit('room:init-state', { users: userStates });
    } catch (err) {
      console.error('[Socket] Failed to send active state to room admin:', err.message);
    }
  }
}

module.exports = new SocketService();
