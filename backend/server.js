const express = require('express');
const cors = require('cors');
const passport = require('passport');
require('dotenv').config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const errorHandler = require('./middleware/errorHandler');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('./socket');
const jwt = require('jsonwebtoken');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5050;
const ALTERNATE_PORT = 5051; // Alternative port if the primary port is in use

// ---------------------------------------------
// Socket.IO setup (real-time messaging)
// ---------------------------------------------
const server = http.createServer(app);

// Lazy-require to avoid breaking deployments where socket.io might be optional
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*', // Expo dev client or web will connect via LAN – allow all origins for now
  },
});

// Map userId -> socketId for routing messages
const onlineUsers = new Map();

// Models needed inside the socket layer (imported lazily to prevent circular deps)
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// Socket authentication middleware – verifies JWT passed via auth token
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch (err) {
    console.error('Socket auth error:', err.message);
    return next(new Error('Invalid auth token'));
  }
});

io.on('connection', (socket) => {
  // Save mapping
  onlineUsers.set(socket.userId, socket.id);

  console.log(`User ${socket.userId} connected via socket ${socket.id}`);

  // Handle sending a message
  socket.on('sendMessage', async ({ receiver, content, attachments = [] }) => {
    try {
      // Persist to DB
      const newMessage = new Message({
        sender: socket.userId,
        receiver,
        content,
        attachments,
      });

      const savedMessage = await newMessage.save();

      // Upsert conversation metadata (participants sorted for uniqueness)
      const participants = [socket.userId.toString(), receiver.toString()].sort();
      await Conversation.findOneAndUpdate(
        { participants: { $all: participants, $size: 2 } },
        {
          participants,
          lastMessage: content,
          lastMessageFrom: socket.userId,
          lastMessageAt: savedMessage.timestamp,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Build lightweight convo summary
      const convoSummary = {
        userId: receiver,
        lastMessage: content || (attachments.length > 0 ? '📎 Attachment' : ''),
        timestamp: savedMessage.timestamp,
        unread: 1,
      };

      // Emit to receiver if online
      const receiverSocketId = onlineUsers.get(receiver.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveMessage', savedMessage);
        io.to(receiverSocketId).emit('conversationUpdated', convoSummary);
      }

      // Emit conversation update to sender as well
      socket.emit('messageSaved', savedMessage);
      socket.emit('conversationUpdated', { ...convoSummary, userId: receiver, unread: 0 });
    } catch (err) {
      console.error('Error handling sendMessage:', err);
      socket.emit('error', { message: err.message || 'Failed to send message' });
    }
  });

  // Mark messages as read
  socket.on('markRead', async ({ messageIds = [] }) => {
    try {
      await Message.updateMany({ _id: { $in: messageIds } }, { $set: { read: true } });
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    console.log(`User ${socket.userId} disconnected`);
  });
});

// Middleware
app.use(helmet());

// Rate limiting – 15-min window, max X requests (configurable)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS – allow specific origins via env (comma-separated) or allow all in dev
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim());
app.use(cors({
  origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));

app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(passport.initialize());

// Set up static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.send('PetEat API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS preflight for all routes
app.options('*', cors());

// Enable CORS for health check specifically
app.use('/api/health', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Import and use routes
const userRoutes = require('./routes/users');
const petRoutes = require('./routes/pets');
const bookingRoutes = require('./routes/bookings');
const messageRoutes = require('./routes/messages');
const otpRoutes = require('./routes/otp');
// const uploadRoutes = require('./routes/uploads'); // Route removed
const inventoryRoutes = require('./routes/inventory');
const nfcTagRoutes = require('./routes/nfcTags');
const pushTokenRoutes = require('./routes/pushTokens');
const adminRoutes = require('./routes/admin');
const videoTokenRoutes = require('./routes/videoToken');
const authTokensRoutes = require('./routes/authTokens');
const notificationsRoutes = require('./routes/notifications');
const petTreatmentRoutes = require('./routes/petTreatments');

app.use('/api/users', userRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/nfc-tags', nfcTagRoutes);
app.use('/api/push-tokens', pushTokenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/video-token', videoTokenRoutes);
app.use('/api/auth', authTokensRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/pet-treatments', petTreatmentRoutes);

// Global error handler (MUST be after all routes)
app.use(errorHandler);

// Function to fix contactNumber index
async function fixContactNumberIndex() {
  try {
    console.log('Checking for problematic contactNumber index...');
    
    // Get connection and collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get existing indexes
    const indexes = await usersCollection.indexes();
    
    // Check if contactNumber index exists
    const contactNumberIndex = indexes.find(index => 
      index.key && index.key.contactNumber === 1
    );
    
    if (contactNumberIndex) {
      console.log('Found contactNumber index:', contactNumberIndex);
      
      // Check if it's not sparse
      if (!contactNumberIndex.sparse) {
        // Drop the existing index
        console.log('Dropping non-sparse contactNumber index...');
        await usersCollection.dropIndex(contactNumberIndex.name);
        console.log('Index dropped successfully');
        
        // Create new sparse index
        console.log('Creating new sparse unique index on contactNumber...');
        await usersCollection.createIndex(
          { contactNumber: 1 }, 
          { 
            unique: true, 
            sparse: true,
            background: true
          }
        );
        console.log('New sparse unique index created successfully');
      } else {
        console.log('ContactNumber index is already sparse, no action needed');
      }
    } else {
      console.log('No contactNumber index found, creating sparse unique index...');
      await usersCollection.createIndex(
        { contactNumber: 1 }, 
        { 
          unique: true, 
          sparse: true,
          background: true
        }
      );
      console.log('Sparse unique index created successfully');
    }
  } catch (error) {
    console.error('Error fixing contactNumber index:', error);
  }
}

// Function to fix username index
async function fixUsernameIndex() {
  try {
    console.log('Checking for problematic username index...');
    
    // Get connection and collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get existing indexes
    const indexes = await usersCollection.indexes();
    
    // Check if username index exists
    const usernameIndex = indexes.find(index => 
      index.key && index.key.username === 1
    );
    
    if (usernameIndex) {
      console.log('Found username index:', usernameIndex);
      
      // Check if it's not sparse
      if (!usernameIndex.sparse) {
        // Drop the existing index
        console.log('Dropping non-sparse username index...');
        await usersCollection.dropIndex(usernameIndex.name);
        console.log('Username index dropped successfully');
        
        // Create new sparse index
        console.log('Creating new sparse unique index on username...');
        await usersCollection.createIndex(
          { username: 1 }, 
          { 
            unique: true, 
            sparse: true,
            background: true
          }
        );
        console.log('New sparse unique username index created successfully');
      } else {
        console.log('Username index is already sparse, no action needed');
      }
    } else {
      console.log('No username index found, creating sparse unique index...');
      await usersCollection.createIndex(
        { username: 1 }, 
        { 
          unique: true, 
          sparse: true,
          background: true
        }
      );
      console.log('Sparse unique username index created successfully');
    }
  } catch (error) {
    console.error('Error fixing username index:', error);
  }
}

// Test code for petOwner field fix - will run once on server start
const testPetTreatmentSchema = async () => {
  try {
    const PetTreatment = require('./models/PetTreatment');
    console.log('Testing PetTreatment schema...');
    // Just check if the model can be accessed without errors
    const schema = PetTreatment.schema;
    console.log('PetTreatment schema loaded successfully');
    console.log('Schema paths:', Object.keys(schema.paths));
    // No need to query the database, just checking if the schema is valid
  } catch (error) {
    console.error('Error testing PetTreatment schema:', error);
  }
};

// Connect to the database before starting the server
const startServer = async () => {
  try {
    await connectDB(); // Connect to MongoDB first
    
    // Run our test function
    await testPetTreatmentSchema();
    
    // Fix index issues
    await fixContactNumberIndex();
    await fixUsernameIndex();
    
    // Start background cron jobs (reminders, etc.)
    require('./jobs/reminderJob');
    
    // Start server after database connection is established
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`HTTP & Socket server running on port ${PORT} (network accessible)`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use, trying alternative port ${ALTERNATE_PORT}`);
        // Try the alternative port
        server.listen(ALTERNATE_PORT, '0.0.0.0', () => {
          console.log(`HTTP & Socket server running on alternative port ${ALTERNATE_PORT} (network accessible)`);
        });
      } else {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();