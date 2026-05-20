const authService = require('../services/auth.service');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied: Token is missing.' });
  }

  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Access denied: Invalid or expired token.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access privileges required.' });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin
};
