const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
exports.isAuthenticated = async (req, res, next) => {
  try {
    console.log('Auth middleware checking authentication');
    
    // Get token from header
    const token = req.header('x-auth-token');
    
    // Debug token presence
    if (token) {
      console.log('Token found in request');
    } else {
      console.log('No token found in request headers');
      console.log('Headers:', req.headers);
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified successfully, user:', decoded.id);
      
      // Ensure the account is email-verified before proceeding
      const dbUser = await User.findById(decoded.id).select('isVerified');
      if (!dbUser) {
        return res.status(401).json({ message: 'User not found' });
      }
      if (dbUser.isVerified === false) {
        return res.status(403).json({ message: 'Email not verified. Please verify your account to continue.' });
      }

      // Attach decoded payload – other middleware/controllers may need extra fields
      req.user = decoded;

      next();
    } catch (verifyErr) {
      console.log('Token verification failed:', verifyErr.message);
      
      if (verifyErr.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      
      if (verifyErr.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token format or signature' });
      }
      
      res.status(401).json({ message: 'Token is not valid', error: verifyErr.message });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Authentication error', error: err.message });
  }
};

// Middleware to check if user is an admin
exports.isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
}; 