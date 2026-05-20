const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretproctorkey123_change_in_production';

class AuthService {
  async register(username, email, password, role = 'user') {
    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      throw new Error('Username or email already exists.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role
    });

    // Generate token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      },
      token
    };
  }

  async login(usernameOrEmail, password) {
    // Find user
    const user = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username: usernameOrEmail },
          { email: usernameOrEmail }
        ]
      }
    });

    if (!user) {
      throw new Error('Invalid credentials.');
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials.');
    }

    // Generate token
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      },
      token
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new Error('Invalid or expired token.');
    }
  }
}

module.exports = new AuthService();
