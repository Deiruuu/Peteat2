const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { body, validationResult } = require('express-validator');
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get current user's notifications
router.get('/', isAuthenticated, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const notifications = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json(notifications);
}));

// Public: get latest announcements
router.get('/announcements', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const announcements = await Notification.find({ type: 'announcement' })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json(announcements);
}));

// Mark a notification as read
router.patch('/:id/read', isAuthenticated, asyncHandler(async (req, res) => {
  const notif = await Notification.findOne({ _id: req.params.id, user: req.user.id });
  if (!notif) return res.status(404).json({ message: 'Not found' });
  notif.readAt = new Date();
  await notif.save();
  res.json(notif);
}));

// Mark all read
router.patch('/mark-all/read', isAuthenticated, asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true });
}));

// Admin: create notification for users
router.post('/',
  isAuthenticated,
  isAdmin,
  [body('userIds').isArray({ min:1 }), body('title').notEmpty(), body('body').notEmpty()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userIds, title, body: msg, data } = req.body;
    const docs = userIds.map(id => ({ user: id, title, body: msg, data }));
    const created = await Notification.insertMany(docs);
    res.status(201).json(created);
  })
);

module.exports = router; 