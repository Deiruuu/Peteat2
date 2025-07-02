const mongoose = require('mongoose');

const nfcTagSchema = new mongoose.Schema({
  tagId: {
    type: String,
    required: true,
    unique: true
  },
  pet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastScannedAt: {
    type: Date
  },
  lastScanLocation: {
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
  scanCount: {
    type: Number,
    default: 0
  },
  isLostPet: {
    type: Boolean,
    default: false
  },
  lostPetDetails: {
    dateReported: Date,
    lastSeenLocation: String,
    contactDetails: String,
    additionalInfo: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a geospatial index on the last scan location
nfcTagSchema.index({ lastScanLocation: '2dsphere' });

module.exports = mongoose.model('NFCTag', nfcTagSchema); 