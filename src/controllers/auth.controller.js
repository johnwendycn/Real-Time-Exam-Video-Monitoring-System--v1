const authService = require('../services/auth.service');
const userService = require('../services/user.service');

class AuthController {
  async signup(req, res) {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    try {
      // Create user. If it's the first user ever, or if we want to allow role assignment in dev:
      // We will allow role configuration but default to 'user'
      const requestedRole = role === 'admin' ? 'admin' : 'user';
      const result = await authService.register(username, email, password, requestedRole);
      
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  async login(req, res) {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    try {
      const result = await authService.login(usernameOrEmail, password);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }
  }

  async getMe(req, res) {
    try {
      const user = await userService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return res.status(200).json(user);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AuthController();
