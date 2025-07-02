const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Utility to automatically forward async errors to Express error handler
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get all bookings
router.get('/', asyncHandler(async (req, res) => {
  const bookings = await Booking.find()
    .populate('petOwner', 'fullName email')
    .populate('clinic', 'fullName')
    .populate('pet', 'name species');
  
  res.json(bookings);
}));

// Get bookings by pet owner
router.get('/pet-owner/:ownerId', asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ petOwner: req.params.ownerId })
    .populate('clinic', 'fullName')
    .populate('pet', 'name species');
  
  res.json(bookings);
}));

// Get bookings by clinic
router.get('/clinic/:clinicId', asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ clinic: req.params.clinicId })
    .populate('petOwner', 'fullName email')
    .populate('pet', 'name species');
  
  res.json(bookings);
}));

// Get single booking
router.get('/:id', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('petOwner', 'fullName email')
    .populate('clinic', 'fullName')
    .populate('pet', 'name species breed age');
  
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  
  res.json(booking);
}));

// Create new booking
router.post('/', isAuthenticated,
  [
    body('petOwner').notEmpty().withMessage('petOwner is required'),
    body('clinic').notEmpty().withMessage('clinic is required'),
    body('pet').notEmpty().withMessage('pet is required'),
    body('bookingDate').notEmpty().withMessage('bookingDate is required'),
    body('appointmentTime').notEmpty().withMessage('appointmentTime is required'),
    body('reason').notEmpty().withMessage('reason is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { petOwner, clinic, pet, bookingDate, appointmentTime, reason } = req.body;
    
    const newBooking = new Booking({
      petOwner,
      clinic,
      pet,
      bookingDate,
      appointmentTime,
      reason,
      status: 'pending'
    });
    
    const savedBooking = await newBooking.save();
    res.status(201).json(savedBooking);
  })
);

// Update booking status
router.put('/:id/status', isAuthenticated, asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Please provide a valid status' });
  }
  
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  
  const prevStatus = booking.status;
  booking.status = status;
  const updatedBooking = await booking.save();
  
  // Auto-create treatment record when in-person booking gets confirmed the first time
  if (
    prevStatus !== 'confirmed' &&
    status === 'confirmed' &&
    booking.appointmentType === 'in_person'
  ) {
    const PetsUnderTreatment = require('../models/PetsUnderTreatment');

    // Prevent duplicate
    const existing = await PetsUnderTreatment.findOne({ pet: booking.pet, clinic: booking.clinic, discharged: false });
    if (!existing) {
      await PetsUnderTreatment.create({
        pet: booking.pet,
        clinic: booking.clinic,
        status: 'Stable',
        room: 'Room 1', // default, can be updated later
        clinicalNotes: booking.reason || 'Admitted for in-person consultation',
        treatmentHistory: [{
          notes: 'Admitted from confirmed booking',
          updatedBy: booking.clinic,
        }]
      });
    }
  }
  
  res.json(updatedBooking);
}));

// Update booking
router.put('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const updatedBooking = await Booking.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );
  
  if (!updatedBooking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  
  res.json(updatedBooking);
}));

// Delete booking
router.delete('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  
  res.json({ message: 'Booking deleted successfully' });
}));

module.exports = router; 