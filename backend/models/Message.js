const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Add conversation field for website compatibility
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Text content – only required if there are **no** attachments
  content: {
    type: String,
    required: function () {
      // `this` refers to the document being validated
      return !this.attachments || this.attachments.length === 0;
    },
    default: '',
  },
  // Add text field for website compatibility (maps to content)
  text: {
    type: String,
    get: function() { return this.content; },
    set: function(v) { this.content = v; return v; }
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Add createdAt/updatedAt for website compatibility
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  },
  // Add readAt for website compatibility
  readAt: {
    type: Date,
    default: null,
  },
  attachments: [{
    type: String
  }]
}, { 
  timestamps: true, // This will handle createdAt and updatedAt automatically
  toJSON: { getters: true } // Include virtual getters when converting to JSON
});

// Index to find conversations between users
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ conversation: 1 });
messageSchema.index({ createdAt: 1 });

// Pre-save middleware to ensure conversation field is set
messageSchema.pre('save', async function(next) {
  // If conversation is not set but we have sender and receiver
  if (!this.conversation && this.sender && this.receiver) {
    try {
      const Conversation = mongoose.model('Conversation');
      // Find or create a conversation between these users
      
      // Ensure we have valid ObjectIds
      const senderObjectId = mongoose.Types.ObjectId.isValid(this.sender) ? 
        new mongoose.Types.ObjectId(this.sender) : this.sender;
      
      const receiverObjectId = mongoose.Types.ObjectId.isValid(this.receiver) ? 
        new mongoose.Types.ObjectId(this.receiver) : this.receiver;
      
      const participants = [senderObjectId, receiverObjectId];
      
      let conversation = await Conversation.findOne({
        participants: { $all: participants, $size: 2 }
      });
      
      if (!conversation) {
        conversation = new Conversation({ participants });
        await conversation.save();
      }
      
      this.conversation = conversation._id;
    } catch (err) {
      console.error('Error setting conversation:', err);
      // Continue even if this fails
    }
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema); 