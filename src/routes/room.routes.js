const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

router.post('/', verifyToken, isAdmin, roomController.createRoom);
router.get('/', verifyToken, roomController.getActiveRooms);
router.delete('/:roomId', verifyToken, isAdmin, roomController.deleteRoom);

module.exports = router;
