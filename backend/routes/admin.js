const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { runReminders } = require('../jobs/reminderJob');

// Simple ping for admin
router.get('/ping', isAuthenticated, isAdmin, (req, res) => {
  res.json({ message: 'pong', time: new Date().toISOString() });
});

// Manually trigger the reminders job
router.post('/trigger-reminders', isAuthenticated, isAdmin, async (req, res) => {
  try {
    await runReminders();
    res.json({ success: true, message: 'Reminders executed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 