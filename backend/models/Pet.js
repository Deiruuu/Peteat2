const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  species: {
    type: String,
    required: true
  },
  breed: {
    type: String
  },
  category: {
    type: String
  },
  age: {
    type: Number
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'unknown']
  },
  weight: {
    type: Number
  },
  medicalHistory: [{
    date: Date,
    description: String,
    treatment: String,
    clinic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  profileImage: {
    type: String
  },
  lastCheckup: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Pet', petSchema); 