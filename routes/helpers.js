/**
 * Auth Helpers
 * Middleware for authentication and authorization
 */

const jwt = require('jsonwebtoken');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const User = req.app.get('User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authorized, token invalid' });
  }
};

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    // Map old 'admin' role to new role system
    let userRole = req.user.role;
    if (userRole === 'admin') {
      userRole = 'super_admin';
    }
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    
    next();
  };
};

module.exports = { protect, restrictTo };