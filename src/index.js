const express = require('express');
const http = require('http');
const path = require('path');
const db = require('./models');
const socketService = require('./services/socket.service');
const mediasoupService = require('./services/mediasoup.service');

require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Express Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/rooms', require('./routes/room.routes'));
app.use('/api/chat', require('./routes/chat.routes'));

// Catch-all route to serve the SPA for other paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start system dependencies and listen
const startSystem = async () => {
  try {
    console.log('[System] Syncing database models...');
    // Sync models
    await db.sequelize.sync({ alter: true });
    console.log('[System] Database synced successfully.');

    // Initialize Mediasoup
    await mediasoupService.initialize();

    // Initialize Socket Server
    socketService.initialize(server);
    console.log('[System] Socket signaling server configured.');

    // Start Listening
    server.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Proctoring & Streaming Server is running on port ${PORT}`);
      console.log(`💻 Local Access: http://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('[System] CRITICAL ERROR starting proctoring system:', err.message);
    process.exit(1);
  }
};

startSystem();
