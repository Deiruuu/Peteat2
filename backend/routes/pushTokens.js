const express = require('express');
const router = express.Router();
const PushToken = require('../models/PushToken');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Utility wrapper to catch errors
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Register or update a push token for the current user
router.post('/',
  isAuthenticated,
  [body('token').notEmpty().withMessage('token is required')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, platform } = req.body;

    // Upsert by token so duplicates are not saved
    const saved = await PushToken.findOneAndUpdate(
      { token },
      { user: req.user.id, platform },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(saved);
  })
);

// List current user's tokens
router.get('/', isAuthenticated, asyncHandler(async (req, res) => {
  const tokens = await PushToken.find({ user: req.user.id });
  res.json(tokens);
}));

// Delete a token (logout from device)
router.delete('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const token = await PushToken.findById(req.params.id);
  if (!token) {
    return res.status(404).json({ message: 'Token not found' });
  }
  if (token.user.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  await token.deleteOne();
  res.json({ message: 'Token removed' });
}));

module.exports = router; 