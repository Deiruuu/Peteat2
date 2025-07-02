const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['email_verification', 'password_reset'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 3600000); // 1 hour from now
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index to expire documents after they expire
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate a random 6-digit code
verificationCodeSchema.statics.generateCode = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create or update a verification code
verificationCodeSchema.statics.createCode = async function(email, type) {
  const code = this.generateCode();
  
  // Find and update if exists, or create new
  const result = await this.findOneAndUpdate(
    { email, type },
    { 
      code,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    },
    { upsert: true, new: true }
  );
  
  return result;
};

module.exports = mongoose.model('VerificationCode', verificationCodeSchema); 