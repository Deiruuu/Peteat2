const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate a new short-lived access token
function generateAccessToken(user) {
  const payload = {
    id: user._id,
    email: user.email,
    userType: user.userType,
    isAdmin: user.isAdmin,
  };
  const expiresIn = process.env.ACCESS_TOKEN_EXP || '15m';
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

// Verify refresh token and rotate
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Optionally: check if refresh token blacklist etc.

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXP || '30d',
    });

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

module.exports = router; 