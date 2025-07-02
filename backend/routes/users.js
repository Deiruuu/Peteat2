const express = require('express');
const router = express.Router();
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const axios = require('axios');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure email sender
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Configure file uploads with multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and documents
  if (file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/pdf' || 
      file.mimetype === 'application/msword' || 
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Configure passport for Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // If user exists with same email but no Google ID, update their account
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }

        // Create new user with Google data (they'll complete registration later)
        const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          fullName: profile.displayName,
          password: '', // Will be updated during registration completion
          userType: 'pet_owner', // Default, can be changed during registration
          profilePicture: profile.photos[0]?.value || ''
        });
        
        // Don't set contactNumber as it might be null and cause unique index issues

        await newUser.save();
        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Generate JWT token
const generateToken = (user, rememberMe = false) => {
  const payload = {
    id: user._id,
    email: user.email,
    userType: user.userType,
    isAdmin: user.isAdmin
  };

  // Token expires in 1 day by default, or 30 days if remember me is checked
  const expiresIn = rememberMe ? '30d' : '1d';
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Generate Refresh Token (long-lived)
const generateRefreshToken = (user) => {
  const payload = { id: user._id };
  const expiresIn = process.env.REFRESH_TOKEN_EXP || '30d';
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
};

// Handle mobile Google OAuth
async function verifyGoogleToken(accessToken) {
  try {
    // Verify the token with Google
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
    );
    
    const profile = response.data;
    
    // Check if user already exists with this Google ID
    let user = await User.findOne({ googleId: profile.sub });

    if (user) {
      return user;
    }

    // If user exists with same email but no Google ID, update their account
    user = await User.findOne({ email: profile.email });
    
    if (user) {
      user.googleId = profile.sub;
      await user.save();
      return user;
    }

    // Create new user with Google data
    const newUser = new User({
      googleId: profile.sub,
      email: profile.email,
      fullName: profile.name,
      password: '', // No password for Google users
      userType: 'pet_owner', // Default
      profilePicture: profile.picture || ''
    });
    
    // Don't set contactNumber - prevent null unique index issues

    await newUser.save();
    return newUser;
  } catch (error) {
    console.error('Error verifying Google token:', error);
    throw new Error('Failed to verify Google token');
  }
}

// Google OAuth routes
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    
    // Redirect to client with token
    res.redirect(`http://localhost:3000/complete-signup?token=${token}`);
  }
);

// Mobile Google authentication
router.post('/auth/google/mobile', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ message: 'Access token is required' });
    }
    
    const user = await verifyGoogleToken(accessToken);
    
    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    res.json({
      token,
      refreshToken,
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('Error in mobile Google auth:', error);
    res.status(500).json({ message: 'Failed to authenticate with Google' });
  }
});

// Get all users (admin only)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user by ID (admin only)
router.get('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get approved clinics for pet owners to message
router.get('/clinics/approved', async (req, res) => {
  try {
    // Include all clinics from both platforms by checking multiple role/userType combinations
    const clinics = await User.find({ 
      $or: [
        { userType: 'clinic', isApproved: true },  // Mobile app format
        { role: 'clinic', isApproved: true },      // Web app format
        { role: 'clinic' }                         // Web app might not have isApproved field
      ]
    })
      .select('_id fullName clinicName profilePicture location operatingHours')
      .limit(50);
    
    // Map the results to a consistent format
    const result = clinics.map(c => ({
      id: c._id,
      fullName: c.clinicName || c.fullName || (c.role === 'clinic' ? c.username : ''),
      clinicName: c.clinicName,
      profilePicture: c.profilePicture || '',
      location: c.location,
      operatingHours: c.operatingHours
    }));
    
    res.json(result);
  } catch (err) {
    console.error('Error fetching approved clinics:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get clinics by pet type
router.get('/clinics/by-pet/:petType', async (req, res) => {
  try {
    const { petType } = req.params;
    
    if (!petType) {
      return res.status(400).json({ message: 'Pet type is required' });
    }
    
    // Find clinics that manage this pet type
    const clinics = await User.find({ 
      userType: 'clinic', 
      isApproved: true,
      petsManaged: petType
    }, '-password');

    // Build full URL for profile pictures and add id field
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const processed = clinics.map((c) => {
      const obj = c.toObject();
      if (obj._id && !obj.id) obj.id = obj._id.toString();
      if (obj.profilePicture && !obj.profilePicture.startsWith('http')) {
        obj.profilePicture = `${baseUrl}/${obj.profilePicture.replace(/^\/+/,'')}`;
      }
      return obj;
    });

    res.json(processed);
  } catch (err) {
    console.error('Error fetching clinics by pet type:', err);
    res.status(500).json({ message: err.message });
  }
});

// Make sure uploads directory exists

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Register pet owner - Add debug logging
router.post('/register/pet-owner', function(req, res, next) {
  console.log("Pet owner registration request received");
  console.log("Request body:", req.body);
  console.log("Headers:", req.headers);
  upload.single('profilePicture')(req, res, function(err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { email, password, fullName, username, contactNumber, address, googleId } = req.body;
    
    // Log the specific fields we care about
    console.log("Extracted fields from request:");
    console.log("- fullName:", fullName);
    console.log("- username:", username);
    console.log("- email:", email);
    console.log("- contactNumber:", contactNumber);
    console.log("- address:", address);
    
    // Basic validation
    if (!email || (!password && !googleId) || !fullName) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }
    
    // Validate email format
    if (!User.validateEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    
    // Validate password strength (skip for Google sign-in)
    if (password && !User.validatePassword(password)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters and include at least one number and one special character' 
      });
    }
    
    // Check if username is already taken (if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username is already taken. Please choose another one.' });
      }
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && !existingUser.googleId) {
      return res.status(400).json({ message: 'User already exists with that email' });
    } else if (existingUser && existingUser.googleId && googleId) {
      // If user exists with Google ID, just update their info and return token
      existingUser.fullName = fullName;
      
      // Add username if provided
      if (username) {
        existingUser.username = username;
      }
      
      // Explicitly set contactNumber and address
      existingUser.contactNumber = contactNumber && contactNumber.trim() !== '' ? contactNumber.trim() : existingUser.contactNumber;
      existingUser.address = address && address.trim() !== '' ? address.trim() : existingUser.address;
      
      existingUser.userType = 'pet_owner';
      
      if (req.file) {
        existingUser.profilePicture = req.file.path.replace(/\\/g, '/');
      }
      
      console.log("Updating existing Google user with fields:", {
        contactNumber: existingUser.contactNumber,
        address: existingUser.address
      });
      
      await existingUser.save();
      
      const token = generateToken(existingUser);
      const refreshToken = generateRefreshToken(existingUser);
      return res.status(200).json({ token, refreshToken, user: { ...existingUser.toObject(), password: undefined } });
    }
    
    // Create a new user
    const newUser = new User({
      email,
      fullName,
      password,
      username: username || undefined, // Only set if provided
      contactNumber: contactNumber && contactNumber.trim() !== '' ? contactNumber.trim() : undefined,
      address: address && address.trim() !== '' ? address.trim() : undefined,
      userType: 'pet_owner',
      googleId
    });
    
    console.log("About to save new user with fields:", {
      email: newUser.email,
      fullName: newUser.fullName,
      contactNumber: newUser.contactNumber,
      address: newUser.address
    });
    
    const savedUser = await newUser.save();
    console.log("User saved successfully with ID:", savedUser._id);
    console.log("Saved user contactNumber:", savedUser.contactNumber);
    console.log("Saved user address:", savedUser.address);
    
    // Generate tokens
    const token = generateToken(savedUser);
    const refreshToken = generateRefreshToken(savedUser);
    
    // Return user data and tokens
    res.status(201).json({
      token,
      refreshToken,
      user: { ...savedUser.toObject(), password: undefined }
    });
  } catch (err) {
    console.error('Pet owner registration error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Register clinic - Add debug logging
router.post('/register/clinic', function(req, res, next) {
  console.log("Clinic registration request received");
  console.log("Request body:", req.body);
  upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'businessPermit', maxCount: 1 },
    { name: 'identificationCard', maxCount: 1 }
  ])(req, res, function(err) {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ message: `File upload error: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { 
      email, password, clinicName, fullName, description, 
      contactNumber, landline, address, zipCode, operatingHours, 
      website, socialMedia, petsManaged, googleId,
      latitude, longitude, licenseNumber
    } = req.body;
    
    // Enhanced debug logging
    console.log("Clinic registration detailed fields:");
    console.log("- email:", email);
    console.log("- password:", password ? "[PROVIDED]" : "[MISSING]");
    console.log("- clinicName:", clinicName);
    console.log("- fullName:", fullName);
    console.log("- licenseNumber:", licenseNumber);
    console.log("- googleId:", googleId);
    
    // Basic validation
    if (!email || (!password && !googleId) || !clinicName) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }
    
    // Validate email format
    if (!User.validateEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    
    // Validate password strength (skip for Google sign-in)
    if (password && !User.validatePassword(password)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters and include at least one number and one special character' 
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with that email' });
    }
    
    // Parse pets managed
    let parsedPetsManaged = [];
    if (petsManaged) {
      try {
        parsedPetsManaged = Array.isArray(petsManaged) 
          ? petsManaged 
          : JSON.parse(petsManaged);
      } catch (e) {
        console.error('Error parsing petsManaged:', e);
      }
    }
    
    // Parse social media
    let parsedSocialMedia = {};
    if (socialMedia) {
      try {
        parsedSocialMedia = typeof socialMedia === 'object' 
          ? socialMedia 
          : JSON.parse(socialMedia);
      } catch (e) {
        console.error('Error parsing socialMedia:', e);
      }
    }
    
    // Create location object
    const location = {
      type: 'Point',
      coordinates: [
        parseFloat(longitude) || 0, 
        parseFloat(latitude) || 0
      ]
    };
    
    // Create documents object
    const documents = {};
    if (req.files) {
      if (req.files.businessPermit) {
        documents.businessPermit = req.files.businessPermit[0].path.replace(/\\/g, '/');
      }
      if (req.files.identificationCard) {
        documents.identificationCard = req.files.identificationCard[0].path.replace(/\\/g, '/');
      }
    }
    
    // Create new clinic user
    const newUser = new User({
      email,
      password,
      fullName,
      clinicName,
      description,
      landline,
      address,
      zipCode,
      operatingHours,
      website,
      socialMedia: parsedSocialMedia,
      petsManaged: parsedPetsManaged,
      userType: 'clinic',
      googleId,
      profilePicture: req.files && req.files.profilePicture 
        ? req.files.profilePicture[0].path.replace(/\\/g, '/') 
        : '',
      documents,
      location,
      isApproved: true // TEMPORARILY ENABLED for testing: Clinic approval bypassed
    });
    
    // Only add contactNumber if it's provided and not empty
    if (contactNumber && contactNumber.trim() !== '') {
      newUser.contactNumber = contactNumber;
    }
    
    const savedUser = await newUser.save();
    
    // Generate tokens
    const token = generateToken(savedUser);
    const refreshToken = generateRefreshToken(savedUser);
    
    // Send notification email to admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: 'New Clinic Registration',
      html: `
        <h2>New Clinic Registration</h2>
        <p>A new clinic has registered and needs approval:</p>
        <ul>
          <li>Clinic Name: ${clinicName}</li>
          <li>Email: ${email}</li>
          <li>Contact Person: ${fullName}</li>
        </ul>
        <p>Please log in to the admin panel to review and approve this clinic.</p>
      `
    };
    
    try {
      await transporter.sendMail(adminMailOptions);
    } catch (emailErr) {
      console.error('Failed to send admin notification email:', emailErr);
      // Continue despite email failure
    }
    
    // Return user data and tokens
    res.status(201).json({
      token,
      refreshToken,
      user: { ...savedUser.toObject(), password: undefined },
      message: 'Clinic registration successful. Your account is pending approval.'
    });
  } catch (err) {
    console.error('Clinic registration error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Legacy registration endpoint for compatibility
router.post('/register', async (req, res) => {
  console.log("Legacy registration API called");
  console.log("Request body:", req.body);
  
  const { email, password, fullName, contactNumber, address, userType, googleId } = req.body;
  
  // Log the specific fields we care about
  console.log("Extracted fields from request:");
  console.log("- fullName:", fullName);
  console.log("- email:", email);
  console.log("- userType:", userType);
  console.log("- contactNumber:", contactNumber);
  console.log("- address:", address);
  
  // Basic validation
  if (!email || (!password && !googleId) || !fullName || !userType) {
    return res.status(400).json({ message: 'Please enter all required fields' });
  }
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser && !existingUser.googleId) {
      return res.status(400).json({ message: 'User already exists with that email' });
    } else if (existingUser && existingUser.googleId && googleId) {
      // If user exists with Google ID, just update their info and return token
      existingUser.fullName = fullName;
      
      // Explicitly set contactNumber and address if they're provided
      if (contactNumber && contactNumber.trim() !== '') {
        existingUser.contactNumber = contactNumber.trim();
        console.log("Setting contactNumber for existing user:", existingUser.contactNumber);
      }
      
      if (address && address.trim() !== '') {
        existingUser.address = address.trim();
        console.log("Setting address for existing user:", existingUser.address);
      }
      
      existingUser.userType = userType;
      
      await existingUser.save();
      
      const token = generateToken(existingUser);
      const refreshToken = generateRefreshToken(existingUser);
      return res.status(200).json({ token, refreshToken, user: { ...existingUser.toObject(), password: undefined } });
    }
    
    // Create new user with explicitly defined fields
    const newUser = new User({
      email,
      password,
      fullName,
      userType,
      googleId,
      isApproved: true, // TEMPORARILY ENABLED for testing: Clinic approval bypassed
      // Explicitly set contactNumber and address
      contactNumber: contactNumber && contactNumber.trim() !== '' ? contactNumber.trim() : undefined,
      address: address && address.trim() !== '' ? address.trim() : undefined
    });
    
    console.log("About to save new user with fields:", {
      email: newUser.email,
      fullName: newUser.fullName,
      userType: newUser.userType,
      contactNumber: newUser.contactNumber,
      address: newUser.address
    });
    
    const savedUser = await newUser.save();
    console.log("User saved successfully with ID:", savedUser._id);
    console.log("Saved user contactNumber:", savedUser.contactNumber);
    console.log("Saved user address:", savedUser.address);
    
    // Generate tokens
    const token = generateToken(savedUser);
    const refreshToken = generateRefreshToken(savedUser);
    
    // Return user data and tokens
    res.status(201).json({
      token,
      refreshToken,
      user: { ...savedUser.toObject(), password: undefined }
    });
  } catch (err) {
    console.error("Error in legacy registration:", err);
    res.status(500).json({ message: err.message });
  }
});

// Fallback route for /register/pet-owner for compatibility
router.post('/register/pet-owner-fallback', async (req, res) => {
  console.log("Pet owner fallback registration API called");
  console.log("Request body:", req.body);
  
  const { email, password, fullName, contactNumber, address } = req.body;
  
  // Log the specific fields we care about
  console.log("Extracted fields from request:");
  console.log("- fullName:", fullName);
  console.log("- email:", email);
  console.log("- contactNumber:", contactNumber);
  console.log("- address:", address);
  
  // Basic validation
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Please enter all required fields' });
  }
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with that email' });
    }
    
    // Create new user with explicitly defined fields
    const newUser = new User({
      email,
      password,
      fullName,
      userType: 'pet_owner',
      // Explicitly add these fields even if they're empty
      contactNumber: contactNumber && contactNumber.trim() !== '' ? contactNumber.trim() : undefined,
      address: address && address.trim() !== '' ? address.trim() : undefined
    });
    
    console.log("About to save new user with fields:", {
      email: newUser.email,
      fullName: newUser.fullName,
      contactNumber: newUser.contactNumber,
      address: newUser.address
    });
    
    const savedUser = await newUser.save();
    console.log("User saved successfully with ID:", savedUser._id);
    console.log("Saved user contactNumber:", savedUser.contactNumber);
    console.log("Saved user address:", savedUser.address);
    
    // Generate tokens
    const token = generateToken(savedUser);
    const refreshToken = generateRefreshToken(savedUser);
    
    // Return user data and tokens
    res.status(201).json({
      token,
      refreshToken,
      user: { ...savedUser.toObject(), password: undefined }
    });
  } catch (err) {
    console.error("Error in pet owner fallback registration:", err);
    res.status(500).json({ message: err.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  
  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter all fields' });
  }
  
  try {
    // Check for existing user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Validate password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
          // TEMPORARILY DISABLED: Clinic approval check
    // if (user.userType === 'clinic' && !user.isApproved) {
    //   return res.status(403).json({ message: 'Your account is pending approval' });
    // }
    
    // Generate tokens
    const token = generateToken(user, rememberMe);
    const refreshToken = generateRefreshToken(user);
    
    // If remember me is checked, store token in user record
    if (rememberMe) {
      user.rememberToken = token;
      await user.save();
    }
    
    // Update last login timestamp
    user.lastLogin = Date.now();
    await user.save();
    
    // Return user data and tokens
    res.json({
      token,
      refreshToken,
      user: { 
        ...user.toObject(), 
        password: undefined,
        isVerified: user.isVerified !== undefined ? user.isVerified : false
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.put('/:id', isAuthenticated, upload.single('profilePicture'), async (req, res) => {
  try {
    // Only admin or the user themselves can update user data
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Prepare the update data from body
    const updateData = { ...req.body };
    
    // Add the profile picture path if a file was uploaded
    if (req.file) {
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }
    
    // Ensure address and contactNumber are properly handled
    if (updateData.address === '') {
      updateData.address = undefined; // Use undefined to not override existing value if empty string
    }
    
    if (updateData.contactNumber === '' || updateData.contactNumber === '+63') {
      updateData.contactNumber = undefined;
    }
    
    // Handle phone field which might be used instead of contactNumber
    if (updateData.phone) {
      updateData.contactNumber = updateData.phone;
      delete updateData.phone; // Remove the phone field as we're using contactNumber
    }
    
    console.log("Updating user with data:", updateData);
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If the profilePicture is a server path, return the full URL
    if (updatedUser.profilePicture && !updatedUser.profilePicture.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      updatedUser.profilePicture = `${baseUrl}/${updatedUser.profilePicture.replace(/^\/+/,'')}`;
    }
    
    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete user (admin only)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forgot password - Request reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account with that email address exists' });
    }
    
    // Generate verification code
    const verification = await VerificationCode.createCode(email, 'password_reset');
    
    // Send email with verification code
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'PetEat Password Reset',
      html: `
        <h2>Reset Your Password</h2>
        <p>You are receiving this because you (or someone else) have requested to reset the password for your account.</p>
        <p>Your verification code is: <strong>${verification.code}</strong></p>
        <p>This code will expire in 60 minutes.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    res.json({ message: 'Password reset code sent to your email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Error processing your request' });
  }
});

// Verify reset code
router.post('/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }
    
    // Find verification code
    const verification = await VerificationCode.findOne({
      email,
      code,
      type: 'password_reset',
      expiresAt: { $gt: new Date() }
    });
    
    if (!verification) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    
    // Generate temporary token for password reset
    const resetToken = jwt.sign(
      { email, action: 'reset_password' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    res.json({ resetToken });
  } catch (err) {
    console.error('Verify reset code error:', err);
    res.status(500).json({ message: 'Error processing your request' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;
    
    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    
    // Validate password strength
    if (!User.validatePassword(newPassword)) {
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters and include at least one number and one special character' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.action !== 'reset_password') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Find user and update password
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    // Delete verification codes for this email
    await VerificationCode.deleteMany({ 
      email: decoded.email, 
      type: 'password_reset' 
    });
    
    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// Get pending clinic approvals (admin only)
router.get('/pending-clinics', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const pendingClinics = await User.find(
      { userType: 'clinic', isApproved: false },
      '-password'
    );
    
    res.json(pendingClinics);
  } catch (err) {
    console.error('Error fetching pending clinics:', err);
    res.status(500).json({ message: err.message });
  }
});

// Approve or reject clinic (admin only)
router.put('/approve-clinic/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { approved } = req.body;
    const userId = req.params.id;
    
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'Approval status is required' });
    }
    
    const clinic = await User.findOne({ _id: userId, userType: 'clinic' });
    
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }
    
    clinic.isApproved = approved;
    await clinic.save();
    
    // Send notification email to clinic
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: clinic.email,
      subject: approved ? 'Your Clinic Registration is Approved' : 'Clinic Registration Status',
      html: approved
        ? `
          <h2>Registration Approved</h2>
          <p>Congratulations! Your clinic registration has been approved.</p>
          <p>You can now log in to the PetEat app and start managing your clinic services.</p>
        `
        : `
          <h2>Registration Not Approved</h2>
          <p>Thank you for your interest in PetEat.</p>
          <p>Unfortunately, we are unable to approve your clinic registration at this time.</p>
          <p>Please contact support for more information.</p>
        `
    };
    
    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error('Failed to send approval email:', emailErr);
      // Continue despite email failure
    }
    
    res.json({ 
      message: approved ? 'Clinic approved successfully' : 'Clinic rejected successfully',
      clinic: { ...clinic.toObject(), password: undefined }
    });
  } catch (err) {
    console.error('Error approving/rejecting clinic:', err);
    res.status(500).json({ message: err.message });
  }
});

// Complete onboarding for a user
router.put('/:id/complete-onboarding', isAuthenticated, (req, res, next) => {
  // Only parse file upload if request is multipart
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart')) {
    return upload.single('profilePicture')(req, res, next);
  }
  next();
}, async (req, res) => {
  try {
    console.log('Complete onboarding request received');
    console.log('User from token:', req.user);
    console.log('Params ID:', req.params.id);
    
    // Check if the user exists and belongs to the logged-in user
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      console.log('Authorization mismatch:', { tokenUserId: req.user.id, requestedId: req.params.id });
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      console.log('User not found with ID:', req.params.id);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Found user:', user.email);
    
    // Update user fields
    const updateData = {
      ...req.body,
      needsOnboarding: false,
      completedOnboarding: true
    };
    
    console.log('Update data:', updateData);
    
    // If there's a profile picture uploaded
    if (req.file) {
      console.log('Profile picture uploaded:', req.file.filename);
      // Generate a URL for the profile picture
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }
    
    // Remove any attempt to change userType to admin
    if (updateData.userType === 'admin' && user.userType !== 'admin') {
      updateData.userType = user.userType; // Keep original role
    }
    
    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    // Convert MongoDB document to plain object and ensure id field exists
    const userObject = updatedUser.toObject();
    
    // Add id field (frontend uses id, backend uses _id)
    if (userObject._id && !userObject.id) {
      userObject.id = userObject._id.toString();
    }
    
    // Ensure profilePicture is full URL
    if (userObject.profilePicture && !userObject.profilePicture.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      userObject.profilePicture = `${baseUrl}/${userObject.profilePicture.replace(/^\/+/,'')}`;
    }
    
    console.log('User updated successfully with ID:', userObject.id);
    res.json(userObject);
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password
router.put('/change-password', isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    // Validate new password strength
    if (!User.validatePassword(newPassword)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and contain a number and special character' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get clinics near given location
router.get('/clinics/nearby', async (req, res) => {
  try {
    const { lat, lng, distance = 5000 } = req.query; // distance in meters
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng are required' });
    const clinics = await User.find({ userType: 'clinic', location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(distance)
      }
    }}).select('clinicName fullName profilePicture address location');
    res.json(clinics);
  } catch (err) {
    console.error('Nearby clinics error:', err);
    res.status(500).json({ message: err.message });
  }
});

// List all pet owner users (for clinics to initiate chat)
router.get('/pet-owners/list', isAuthenticated, async (req, res) => {
  try {
    const { q = '' } = req.query;
    const searchRegex = new RegExp(q.toString(), 'i');
    // Only return basic public info needed for chat
    // Include users from both web and mobile platforms
    const owners = await User.find({ 
      $or: [
        { userType: 'pet_owner', fullName: { $regex: searchRegex } },  // Mobile app format
        { role: 'pet owner', fullName: { $regex: searchRegex } },      // Web app format
        { role: 'user', fullName: { $regex: searchRegex } },           // Web app might use 'user' role
        { role: 'pet_owner', fullName: { $regex: searchRegex } }       // Alternative format
      ]
    },
      'fullName profilePicture contactNumber').limit(50);
    // Map id field
    const result = owners.map(u => ({
      id: u._id,
      fullName: u.fullName || u.username || 'User',  // Fallback to username if fullName not available
      profilePicture: u.profilePicture || '',
      contactNumber: u.contactNumber || ''
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching pet owners:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get basic user info (for chat, etc.) - no authentication required
router.get('/:id/public', async (req, res) => {
  try {
    // Only return non-sensitive fields needed for UI
    const user = await User.findById(req.params.id)
      .select('fullName profilePicture userType clinicName role username email')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Determine user type - handle both web and mobile formats
    const userType = user.userType || user.role || 'unknown';
    const isClinic = userType === 'clinic' || userType === 'clinic_admin';
    
    // Get the best display name based on available fields
    const displayName = isClinic 
      ? (user.clinicName || user.fullName || user.username || 'Unknown Clinic')
      : (user.fullName || user.username || 'Unknown User');
    
    // Build profile picture URL if it's a relative path
    let profilePicture = user.profilePicture || '';
    if (profilePicture && !profilePicture.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      profilePicture = `${baseUrl}/${profilePicture.replace(/^\/+/,'')}`;
    }
    
    // Return user info with consistent field names
    res.json({
      id: user._id,
      _id: user._id, // Include both formats for compatibility
      fullName: displayName,
      clinicName: user.clinicName || '',
      username: user.username || '',
      email: user.email || '',
      profilePicture: profilePicture,
      userType: userType,
      role: userType // Include both formats for compatibility
    });
  } catch (err) {
    console.error('Error fetching public user info:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 