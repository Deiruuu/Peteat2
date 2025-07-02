const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { AccessToken } = require('twilio').jwt;
const VideoGrant = AccessToken.VideoGrant;

/**
 * POST /api/video-token
 * Body: { room: string }
 * Returns: { token }
 */
router.post('/', isAuthenticated, (req, res) => {
  try {
    const { room } = req.body;
    if (!room) return res.status(400).json({ message: 'room is required' });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    if (!accountSid || !apiKey || !apiSecret) {
      return res.status(500).json({ message: 'Twilio env vars not configured' });
    }

    const token = new AccessToken(accountSid, apiKey, apiSecret, { ttl: 60 * 60 }); // 1h
    token.identity = req.user.id.toString();

    const grant = new VideoGrant({ room });
    token.addGrant(grant);

    res.json({ token: token.toJwt() });
  } catch (err) {
    console.error('Error generating video token', err);
    res.status(500).json({ message: 'Failed to generate token' });
  }
});

module.exports = router; 