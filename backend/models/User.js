const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password not required if using Google auth
    },
    minlength: 8 // Increasing minimum password length
  },
  fullName: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    // Do not set a default; if the field is absent it will be omitted, keeping sparse index safe
  },
  userType: {
    type: String,
    enum: ['pet_owner', 'clinic', 'admin'],
    required: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  address: {
    type: String
  },
  // Additional fields for clinic users
  clinicName: {
    type: String,
    required: function() {
      return this.userType === 'clinic';
    }
  },
  description: {
    type: String
  },
  licenseNumber: {
    type: String,
    validate: {
      validator: function(value) {
        // If userType is clinic, licenseNumber is required
        if (this.userType === 'clinic') {
          return typeof value === 'string' && value.trim().length > 0;
        }
        return true;
      },
      message: 'License number is required for clinics.'
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  zipCode: {
    type: String
  },
  operatingHours: {
    type: String
  },
  landline: {
    type: String
  },
  website: {
    type: String
  },
  socialMedia: {
    type: Map,
    of: String
  },
  documents: {
    businessPermit: String,
    identificationCard: String
  },
  // Pet types that a clinic manages
  petsManaged: [{
    type: String
  }],
  isApproved: {
    type: Boolean,
    // TEMPORARY: Setting all users to approved by default for testing purposes
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  googleId: {
    type: String
  },
  rememberToken: {
    type: String
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  needsOnboarding: {
    type: Boolean,
    default: true
  },
  completedOnboarding: {
    type: Boolean,
    default: false
  }
});

// Create a 2dsphere index on the location field for geospatial queries
userSchema.index({ location: '2dsphere' });

// Note: We're not defining a contactNumber index here
// The server.js will handle creating a proper sparse unique index on startup

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if a password meets requirements
userSchema.statics.validatePassword = function(password) {
  // At least 8 characters, at least one number, and at least one special character
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
  return passwordRegex.test(password);
};

// Method to validate email format
userSchema.statics.validateEmail = function(email) {
  // Basic email validation for common providers
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

// Method to generate password reset token
userSchema.methods.generateResetToken = async function() {
  // Generate a random token
  const token = require('crypto').randomBytes(20).toString('hex');
  
  // Set token and expiration (1 hour)
  this.resetPasswordToken = token;
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  
  await this.save();
  return token;
};

module.exports = mongoose.model('User', userSchema); 