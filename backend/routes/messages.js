const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all messages
router.get('/', async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('sender', 'fullName')
      .populate('receiver', 'fullName');
    
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get conversation between two users
router.get('/conversation', async (req, res) => {
  const { user1, user2 } = req.query;
  
  if (!user1 || !user2) {
    return res.status(400).json({ message: 'Please provide both user IDs' });
  }
  
  // Validate user IDs
  if (user1 === 'undefined' || user2 === 'undefined') {
    return res.status(400).json({ message: 'Invalid user ID provided' });
  }
  
  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(user1) || !mongoose.Types.ObjectId.isValid(user2)) {
    return res.status(400).json({ message: 'Invalid user ID format' });
  }
  
  try {
    // Convert to ObjectIds
    const user1Id = new mongoose.Types.ObjectId(user1);
    const user2Id = new mongoose.Types.ObjectId(user2);
    
    const messages = await Message.find({
      $or: [
        { sender: user1Id, receiver: user2Id },
        { sender: user2Id, receiver: user1Id }
      ]
    })
    .sort({ timestamp: 1 })
    .populate('sender', 'fullName profilePicture')
    .populate('receiver', 'fullName profilePicture');
    
    res.json(messages);
  } catch (err) {
    console.error('Error in conversation route:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get user conversations (list of users the user has chatted with)
router.get('/user-conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Convert to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch conversations where user is a participant, ordered by latest activity
    const conversations = await Conversation.find({ participants: userObjectId })
      .sort({ lastMessageAt: -1 })
      .populate('participants', 'fullName profilePicture userType');

    const summaries = [];
    for (const conv of conversations) {
      let partner = conv.participants.find((p) => p._id?.toString() === userId.toString() ? false : true);
      
      // If partner is not populated, try to find the partner ID and load it
      if (!partner || !partner.fullName) {
        const otherParticipantId = conv.participants.find(p => 
          (typeof p === 'string' || p instanceof mongoose.Types.ObjectId) && 
          p.toString() !== userId.toString()
        );
        
        if (otherParticipantId) {
          try {
            partner = await User.findById(otherParticipantId)
              .select('fullName profilePicture userType')
              .lean();
          } catch (err) {
            console.error('Error loading partner:', err);
          }
        }
      }
      
      summaries.push({
        conversationId: conv._id,
        userId: partner?._id,
        partnerName: partner?.fullName || 'Unknown',
        partnerPicture: partner?.profilePicture || '',
        partnerType: partner?.userType,
        lastMessage: conv.lastMessage,
        timestamp: conv.lastMessageAt,
        unread: 0,
      });
    }

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get unread message count
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.params.userId,
      read: false
    });
    
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a new message
router.post('/', isAuthenticated,
  [
    body('sender').notEmpty().withMessage('sender is required'),
    body('receiver').notEmpty().withMessage('receiver is required'),
    // Custom validator: require either non-empty content or at least one attachment
    body().custom((value) => {
      if ((!value.content || value.content.trim() === '') && (!value.attachments || value.attachments.length === 0)) {
        throw new Error('Either content or attachments is required');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { sender, receiver, content = '', attachments = [] } = req.body;
    
    if (!sender || !receiver || ((content.trim() === '') && attachments.length === 0)) {
      return res.status(400).json({ message: 'Please provide sender, receiver and either content or attachments' });
    }
    
    const newMessage = new Message({
      sender,
      receiver,
      content: content.trim(),
      attachments,
    });
    
    try {
      const savedMessage = await newMessage.save();

      // Update or create conversation metadata
      const participants = [sender.toString(), receiver.toString()].sort();
      let convo = await Conversation.findOne({ participants: { $all: participants, $size: 2 } });
      if (!convo) {
        convo = new Conversation({ participants });
      }
      convo.lastMessage = content && content.trim() !== '' ? content : (attachments.length > 0 ? '📎 Attachment' : '');
      convo.lastMessageFrom = sender;
      convo.lastMessageAt = savedMessage.timestamp;
      await convo.save();

      res.status(201).json(savedMessage);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

// Mark messages as read
router.put('/mark-read', isAuthenticated, async (req, res) => {
  const { messageIds } = req.body;
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ message: 'Please provide an array of message IDs' });
  }
  
  try {
    const result = await Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { read: true } }
    );
    
    res.json({
      message: 'Messages marked as read',
      count: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a message
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Website-compatible routes
// Get all conversations for current user
router.get('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all conversations where the user is a participant
    const conversations = await Conversation.find({ participants: userId })
      .populate({
        path: 'participants',
        select: 'fullName clinicName email userType profilePicture'
      })
      .sort({ lastMessageAt: -1 });
    
    // Format the response data
    const formattedConversations = conversations.map(conv => {
      // Find the other participant (not the current user)
      const otherParticipant = conv.participants.find(
        p => p._id.toString() !== userId.toString()
      );
      
      return {
        _id: conv._id,
        participant: otherParticipant,
        lastMessageText: conv.lastMessage,
        lastMessageDate: conv.lastMessageAt,
        unreadCount: conv.unreadCount || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });
    
    res.json({ 
      success: true, 
      data: formattedConversations 
    });
  } catch (err) {
    console.error('Error in getConversations:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch conversations',
      error: err.message 
    });
  }
});

// Start a new conversation (or return existing)
router.post('/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const { clinicId, ownerId } = req.body;
    
    // Check if request is from pet owner or clinic
    const isPetOwner = req.user.userType === 'pet_owner';
    const isClinic = req.user.userType === 'clinic';
    
    console.log('Creating conversation - User:', userId, 'Type:', req.user.userType);
    console.log('Request body:', req.body);
    
    // Set the other participant ID based on who is initiating
    const otherParticipantId = isPetOwner ? clinicId : ownerId;
    
    // Check for undefined or string 'undefined' values
    if (!otherParticipantId || otherParticipantId === 'undefined') {
      return res.status(400).json({ 
        success: false, 
        message: isPetOwner ? 'Valid Clinic ID is required' : 'Valid Owner ID is required' 
      });
    }
    
    // Validate that both IDs are valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('Invalid user ID format:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(otherParticipantId)) {
      console.error('Invalid partner ID format:', otherParticipantId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    // Convert string IDs to ObjectIds
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const otherUserObjectId = new mongoose.Types.ObjectId(otherParticipantId);
    
    console.log('Converted IDs - User:', userObjectId, 'Partner:', otherUserObjectId);
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userObjectId, otherUserObjectId] }
    });
    
    if (conversation) {
      console.log('Found existing conversation:', conversation._id);
    } else {
      console.log('Creating new conversation between', userObjectId, 'and', otherUserObjectId);
    }
    
    // If not, create a new conversation
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userObjectId, otherUserObjectId],
        lastMessageAt: new Date()
      });
      
      // Populate participants for response
      conversation = await Conversation.findById(conversation._id)
        .populate({
          path: 'participants',
          select: 'fullName clinicName email userType profilePicture'
        });
    }
    
    res.json({ 
      success: true, 
      data: conversation 
    });
  } catch (err) {
    console.error('Error in startConversation:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start conversation',
      error: err.message 
    });
  }
});

// Get all messages in a conversation
router.get('/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Verify the conversation exists and user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found or you are not a participant' 
      });
    }
    
    // Get messages and populate sender info
    const messages = await Message.find({ conversation: conversationId })
      .populate({
        path: 'sender',
        select: 'fullName clinicName email userType profilePicture'
      })
      .sort({ createdAt: 1 });
    
    // Mark messages as read if they were sent to this user
    await Message.updateMany(
      { 
        conversation: conversationId,
        sender: { $ne: userId },
        read: false
      },
      { 
        read: true,
        readAt: new Date()
      }
    );
    
    // Reset unread count for this conversation
    await Conversation.findByIdAndUpdate(
      conversationId,
      { unreadCount: 0 }
    );
    
    res.json({ 
      success: true, 
      data: messages 
    });
  } catch (err) {
    console.error('Error in getMessages:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch messages',
      error: err.message 
    });
  }
});

// Send a new message
router.post('/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const senderId = req.user.id;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
      });
    }
    
    // Verify the conversation exists and user is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId
    });
    
    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found or you are not a participant' 
      });
    }
    
    // Find the recipient (not the sender)
    const recipient = conversation.participants.find(
      p => p.toString() !== senderId.toString()
    );
    
    // Create the message
    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      receiver: recipient,
      text: text.trim() // This will set content via the setter
    });
    
    // Get the populated message to return
    const populatedMessage = await Message.findById(message._id)
      .populate({
        path: 'sender',
        select: 'fullName clinicName email userType profilePicture'
      });
    
    // Update the conversation with last message info
    await Conversation.findByIdAndUpdate(
      conversationId,
      { 
        lastMessageId: message._id,
        lastMessageText: text.trim(),
        lastMessageFrom: senderId,
        lastMessageAt: new Date(),
        // Increment unread count for the recipient
        $inc: { unreadCount: 1 }
      }
    );
    
    res.json({ 
      success: true, 
      data: populatedMessage 
    });
  } catch (err) {
    console.error('Error in sendMessage:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message',
      error: err.message 
    });
  }
});

module.exports = router; 