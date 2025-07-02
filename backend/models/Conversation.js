const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Exactly two participants (pet owner & clinic). We'll store their user IDs.
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  ],
  // Last message preview
  lastMessage: {
    type: String,
  },
  // Reference to the last message (for website compatibility)
  lastMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  // Text of the last message (for website compatibility)
  lastMessageText: {
    type: String,
    get: function() { return this.lastMessage; },
    set: function(v) { this.lastMessage = v; return v; }
  },
  // Who sent the last message (for badge direction)
  lastMessageFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Timestamp of the last message
  lastMessageAt: {
    type: Date,
    default: Date.now,
    alias: 'lastMessageDate' // Alias for website compatibility
  },
  // Unread count for website compatibility
  unreadCount: {
    type: Number,
    default: 0
  },
}, {
  timestamps: true, // Add createdAt and updatedAt
  toJSON: { getters: true, virtuals: true } // Include getters and virtuals
});

// Index to speed-up lookup by participant list
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 }); // For sorting by latest message

module.exports = mongoose.model('Conversation', conversationSchema); 