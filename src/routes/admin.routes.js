const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

router.get('/logs', verifyToken, isAdmin, adminController.getLogs);
router.get('/metrics', verifyToken, isAdmin, adminController.getMetrics);
router.post('/block/:userId', verifyToken, isAdmin, adminController.blockUser);

module.exports = router;
