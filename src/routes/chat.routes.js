const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/room/:roomId/public', verifyToken, chatController.getRoomPublicHistory);
router.get('/private/:roomId/:userId', verifyToken, chatController.getPrivateHistory);

module.exports = router;
