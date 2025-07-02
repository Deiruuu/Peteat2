const mongoose = require('mongoose');

const petsUnderTreatmentSchema = new mongoose.Schema({
  pet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pet',
    required: true,
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // role clinic
    required: true,
  },
  petOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // role pet_owner
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  status: {
    type: String,
    enum: ['Critical', 'Stable', 'Improving', 'Recovered'],
    default: 'Stable',
  },
  room: {
    type: String,
    required: true,
    enum: ['Room 1','Room 2','Room 3','Room 4','Room 5','ICU','Recovery','Surgery','Isolation'],
  },
  admissionDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  clinicalNotes: {
    type: String,
    default: '',
  },
  treatmentHistory: [
    {
      date: {
        type: Date,
        default: Date.now,
      },
      notes: {
        type: String,
        required: true,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    },
  ],
  diagnosis: {
    type: String,
    default: '',
  },
  expectedDischargeDate: Date,
  discharged: {
    type: Boolean,
    default: false,
  },
  dischargedDate: Date,
}, { timestamps: true });

// Update lastUpdated before save
petsUnderTreatmentSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('PetsUnderTreatment', petsUnderTreatmentSchema, 'petsundertreatments'); 