/**
 * Auth Helpers
 * Middleware for authentication and authorization
 * Supports role-based access control: super_admin, editor, lead_manager, viewer, user
 */

const jwt = require('jsonwebtoken');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
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

// Restrict to specific roles - supports both old 'admin' and new role system
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    // Map legacy 'admin' role to 'super_admin' for backward compatibility
    let userRole = req.user.role;
    if (userRole === 'admin') {
      userRole = 'super_admin';
    }
    
    // Check if user has any of the allowed roles
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    
    next();
  };
};

// Check if user has permission for specific action
const hasPermission = (action) => {
  const permissions = {
    // super_admin can do everything
    super_admin: ['all'],
    // editor can manage content but not users
    editor: ['create', 'read', 'update', 'delete', 'publish', 'analytics'],
    // lead_manager can manage leads and view analytics
    lead_manager: ['read', 'update', 'leads', 'analytics'],
    // viewer can only read
    viewer: ['read'],
    // regular user has minimal access
    user: ['read']
  };
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    let userRole = req.user.role;
    if (userRole === 'admin') userRole = 'super_admin';
    
    const userPermissions = permissions[userRole] || [];
    if (userPermissions.includes('all') || userPermissions.includes(action)) {
      next();
    } else {
      res.status(403).json({ error: 'Permission denied for this action' });
    }
  };
};

module.exports = { protect, restrictTo, hasPermission };