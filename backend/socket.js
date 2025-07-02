const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const User = require('./models/User');
const mongoose = require('mongoose');

// Map to keep track of online users and their corresponding socket IDs
const onlineUsers = new Map();

module.exports = (io) => {
  // Middleware – authenticate every Socket.IO connection
  io.use((socket, next) => {
    try {
      // Client should send token either as auth.token or query.token
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // e.g. { id, role, ... }
      socket.userId = decoded.id; // Make sure userId is always available
      return next();
    } catch (err) {
      return next(new Error('Authentication error: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;

    // Mark user as online
    onlineUsers.set(userId, socket.id);
    socket.join(userId); // Join a private room named by user ID for easy targeting

    console.log(`User ${userId} connected via socket ${socket.id}`);
    
    // Debug: Log all online users
    console.log('Online users:', Array.from(onlineUsers.entries()));

    // Handle sending messages (mobile app format)
    socket.on('sendMessage', async ({ receiver, content = '', attachments = [] }) => {
      try {
        if (!receiver || ((content.trim() === '') && attachments.length === 0)) {
          return socket.emit('error', { message: 'receiver and either content or attachments is required' });
        }

        // Validate receiver ID
        if (!mongoose.Types.ObjectId.isValid(receiver)) {
          return socket.emit('error', { message: 'Invalid receiver ID format' });
        }

        console.log(`Message from ${userId} to ${receiver}: ${content}`);

        // Create new message
        const newMessage = new Message({
          sender: userId,
          receiver,
          content,
          attachments,
        });

        // Save message in DB
        const savedMessage = await newMessage.save();
        console.log('Message saved with ID:', savedMessage._id);

        // Upsert conversation document
        const lastMessagePreview = content && content.trim() !== '' ? content : (attachments.length > 0 ? '📎 Attachment' : '');

        // Ensure we have valid ObjectIds
        const senderObjectId = mongoose.Types.ObjectId.isValid(userId) ? 
          new mongoose.Types.ObjectId(userId) : userId;
        
        const receiverObjectId = mongoose.Types.ObjectId.isValid(receiver) ? 
          new mongoose.Types.ObjectId(receiver) : receiver;

        const participantsSorted = [senderObjectId.toString(), receiverObjectId.toString()].sort();

        const convoDoc = await Conversation.findOneAndUpdate(
          { participants: { $all: participantsSorted, $size: 2 } },
          {
            $set: { 
              lastMessage: lastMessagePreview, 
              lastMessageAt: new Date(),
              lastMessageFrom: senderObjectId,
              lastMessageText: lastMessagePreview
            },
            $setOnInsert: { participants: [senderObjectId, receiverObjectId] },
          },
          { new: true, upsert: true }
        );

        console.log('Conversation updated with ID:', convoDoc._id);
        console.log('Receiver socket ID:', onlineUsers.get(receiver.toString()));

        // Emit message to receiver if online - try multiple formats
        const receiverSocketId = onlineUsers.get(receiver.toString());
        if (receiverSocketId) {
          console.log(`Emitting message to socket ${receiverSocketId}`);
          
          // Emit in mobile format
          io.to(receiverSocketId).emit('receiveMessage', savedMessage);
          
          // Also emit in web format for compatibility
          io.to(receiverSocketId).emit('newMessage', {
            conversationId: convoDoc._id.toString(),
            message: savedMessage
          });
        } else {
          // If no direct socket ID, try broadcasting to the user's room
          console.log(`Broadcasting to room ${receiver}`);
          io.to(receiver.toString()).emit('receiveMessage', savedMessage);
          io.to(receiver.toString()).emit('newMessage', {
            conversationId: convoDoc._id.toString(),
            message: savedMessage
          });
        }

        // Acknowledge sender
        socket.emit('messageSaved', savedMessage);

        // Send / update conversation summary for inbox realtime update
        const convoSummary = {
          conversationId: convoDoc?._id?.toString() || '',
          userId: receiver,
          lastMessage: lastMessagePreview,
          timestamp: savedMessage.timestamp || new Date(),
          unread: 0,
        };

        // Emit to both participants for real-time updates
        socket.emit('conversationUpdated', convoSummary);
        
        // Try multiple ways to reach the receiver
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('conversationUpdated', {
            ...convoSummary,
            userId: userId,
            unread: 1
          });
        }
        io.to(receiver.toString()).emit('conversationUpdated', {
          ...convoSummary,
          userId: userId,
          unread: 1
        });

        // Also emit in web format for web clients
        socket.emit('newMessage', {
          conversationId: convoDoc?._id?.toString(),
          message: savedMessage
        });
        
        // Broadcast to all sockets in the receiver's room
        io.to(receiver.toString()).emit('newMessage', {
          conversationId: convoDoc?._id?.toString(),
          message: savedMessage
        });
      } catch (err) {
        console.error('sendMessage error:', err);
        socket.emit('error', { message: 'Failed to send message', error: err.message });
      }
    });

    // Handle web platform message format
    socket.on('newMessage', async ({ conversationId, text }) => {
      try {
        if (!conversationId || !text || text.trim() === '') {
          return socket.emit('error', { message: 'Conversation ID and text are required' });
        }

        console.log(`Web message from ${userId} in conversation ${conversationId}: ${text}`);

        // Find the conversation to get the recipient
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }

        // Find the recipient (not the sender)
        const recipient = conversation.participants.find(
          p => p.toString() !== userId.toString()
        );

        if (!recipient) {
          return socket.emit('error', { message: 'Recipient not found in conversation' });
        }

        console.log(`Web message recipient: ${recipient}`);

        // Create new message
        const newMessage = new Message({
          conversation: conversationId,
          sender: userId,
          receiver: recipient,
          content: text.trim(),
          text: text.trim() // For web compatibility
        });

        const savedMessage = await newMessage.save();
        console.log('Web message saved with ID:', savedMessage._id);

        // Update conversation
        await Conversation.findByIdAndUpdate(
          conversationId,
          {
            lastMessage: text.trim(),
            lastMessageText: text.trim(),
            lastMessageFrom: userId,
            lastMessageAt: new Date(),
            $inc: { unreadCount: 1 }
          }
        );

        // Emit to both web and mobile formats
        const formattedMessage = {
          ...savedMessage.toObject(),
          sender: { _id: userId }
        };

        // Check if recipient is online
        const recipientSocketId = onlineUsers.get(recipient.toString());
        console.log('Recipient socket ID:', recipientSocketId);

        // Emit in web format
        socket.emit('newMessage', {
          conversationId,
          message: formattedMessage
        });

        // Try multiple ways to reach the recipient
        if (recipientSocketId) {
          console.log(`Emitting web message to socket ${recipientSocketId}`);
          io.to(recipientSocketId).emit('newMessage', {
            conversationId,
            message: formattedMessage
          });
          
          // Also emit in mobile format
          io.to(recipientSocketId).emit('receiveMessage', savedMessage);
        }
        
        // Also broadcast to the recipient's room
        io.to(recipient.toString()).emit('newMessage', {
          conversationId,
          message: formattedMessage
        });
        io.to(recipient.toString()).emit('receiveMessage', savedMessage);

        // Also emit in mobile format to sender
        socket.emit('messageSaved', savedMessage);
        
        // Send conversation update
        const convoSummary = {
          conversationId,
          userId: recipient.toString(),
          lastMessage: text.trim(),
          timestamp: new Date(),
          unread: 0
        };

        socket.emit('conversationUpdated', convoSummary);
        
        // Try multiple ways to reach the recipient for conversation updates
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('conversationUpdated', {
            ...convoSummary,
            userId: userId,
            unread: 1
          });
        }
        io.to(recipient.toString()).emit('conversationUpdated', {
          ...convoSummary,
          userId: userId,
          unread: 1
        });
      } catch (err) {
        console.error('newMessage error:', err);
        socket.emit('error', { message: 'Failed to send message', error: err.message });
      }
    });

    // Mark messages as read
    socket.on('markRead', async ({ messageIds }) => {
      try {
        await Message.updateMany({ _id: { $in: messageIds } }, { 
          $set: { 
            read: true,
            readAt: new Date()
          } 
        });
        socket.emit('readReceipt', { messageIds });
      } catch (err) {
        console.error('markRead error:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      console.log(`User ${userId} disconnected`);
    });
  });
}; 