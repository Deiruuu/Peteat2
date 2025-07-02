const express = require('express');
const router = express.Router();
const PetTreatment = require('../models/PetTreatment');
const Booking = require('../models/Booking');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Utility to automatically forward async errors to Express error handler
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get all pet treatments for a clinic
router.get('/clinic/:clinicId', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== req.params.clinicId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const treatments = await PetTreatment.find({ 
    clinic: req.params.clinicId,
    discharged: false
  })
    .populate('petOwner', 'fullName email contactNumber profilePicture')
    .populate('pet', 'name species breed age gender weight profileImage')
    .populate('booking', 'bookingDate appointmentTime reason')
    .sort({ lastUpdate: -1 });
  
  res.json(treatments);
}));

// Get all pet treatments for a pet owner
router.get('/pet-owner/:ownerId', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same user or admin)
  if (req.user.id !== req.params.ownerId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const treatments = await PetTreatment.find({ petOwner: req.params.ownerId })
    .populate('clinic', 'fullName clinicName profilePicture')
    .populate('pet', 'name species breed age gender profileImage')
    .populate('booking', 'bookingDate appointmentTime reason')
    .sort({ lastUpdate: -1 });
  
  res.json(treatments);
}));

// Get a single pet treatment
router.get('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const treatment = await PetTreatment.findById(req.params.id)
    .populate('petOwner', 'fullName email contactNumber profilePicture')
    .populate('clinic', 'fullName clinicName profilePicture')
    .populate('pet', 'name species breed age gender weight profileImage')
    .populate('booking', 'bookingDate appointmentTime reason');
  
  if (!treatment) {
    return res.status(404).json({ message: 'Treatment not found' });
  }
  
  // Check if user is authorized (pet owner, clinic, or admin)
  if (
    req.user.id !== treatment.petOwner._id.toString() && 
    req.user.id !== treatment.clinic._id.toString() && 
    req.user.userType !== 'admin'
  ) {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  res.json(treatment);
}));

// Create a new pet treatment (automatically from a booking)
router.post('/from-booking/:bookingId', isAuthenticated, asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate('petOwner')
    .populate('clinic')
    .populate('pet');
  
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }
  
  // Check if user is authorized (clinic or admin only)
  if (req.user.id !== booking.clinic._id.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Only clinics can create treatments' });
  }
  
  // Check if booking is confirmed and in-person
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ message: 'Booking must be confirmed to create a treatment' });
  }
  
  // Check if a treatment already exists for this booking
  const existingTreatment = await PetTreatment.findOne({ booking: booking._id });
  if (existingTreatment) {
    return res.status(400).json({ message: 'A treatment already exists for this booking' });
  }
  
  // Extract condition from request body
  const { condition, room, assignedTo } = req.body;
  
  if (!condition) {
    return res.status(400).json({ message: 'Condition is required' });
  }
  
  const newTreatment = new PetTreatment({
    booking: booking._id,
    petOwner: booking.petOwner._id,
    clinic: booking.clinic._id,
    pet: booking.pet._id,
    condition,
    room,
    assignedTo,
    notes: [{
      content: `Pet admitted for ${condition}`,
      updatedBy: req.user.id
    }]
  });
  
  const savedTreatment = await newTreatment.save();
  
  // Update booking status to in-progress
  booking.status = 'in-progress';
  await booking.save();
  
  res.status(201).json(savedTreatment);
}));

// Update pet treatment status
router.patch('/:id/status', isAuthenticated, asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  if (!status || !['Critical', 'Stable', 'Improving', 'Recovered'].includes(status)) {
    return res.status(400).json({ message: 'Please provide a valid status' });
  }
  
  const treatment = await PetTreatment.findById(req.params.id);
  
  if (!treatment) {
    return res.status(404).json({ message: 'Treatment not found' });
  }
  
  // Check if user is authorized (clinic or admin only)
  if (req.user.id !== treatment.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Only clinics can update treatment status' });
  }
  
  treatment.status = status;
  treatment.lastUpdate = new Date();
  
  const updatedTreatment = await treatment.save();
  
  res.json(updatedTreatment);
}));

// Add a note to a pet treatment
router.post('/:id/notes', isAuthenticated, 
  [
    body('content').notEmpty().withMessage('Note content is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { content } = req.body;
    const treatment = await PetTreatment.findById(req.params.id);
    
    if (!treatment) {
      return res.status(404).json({ message: 'Treatment not found' });
    }
    
    // Check if user is authorized (clinic or admin only)
    if (req.user.id !== treatment.clinic.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Only clinics can add notes' });
    }
    
    treatment.notes.push({
      content,
      updatedBy: req.user.id
    });
    
    treatment.lastUpdate = new Date();
    
    const updatedTreatment = await treatment.save();
    
    res.json(updatedTreatment);
  })
);

// Discharge a pet
router.patch('/:id/discharge', isAuthenticated, asyncHandler(async (req, res) => {
  const treatment = await PetTreatment.findById(req.params.id);
  
  if (!treatment) {
    return res.status(404).json({ message: 'Treatment not found' });
  }
  
  // Check if user is authorized (clinic or admin only)
  if (req.user.id !== treatment.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Only clinics can discharge pets' });
  }
  
  // Update treatment
  treatment.discharged = true;
  treatment.dischargeDate = new Date();
  treatment.status = 'recovered';
  treatment.lastUpdate = new Date();
  
  // Add discharge note if provided
  if (req.body.note) {
    treatment.notes.push({
      content: req.body.note,
      updatedBy: req.user.id
    });
  } else {
    treatment.notes.push({
      content: 'Pet discharged',
      updatedBy: req.user.id
    });
  }
  
  const updatedTreatment = await treatment.save();
  
  // Update associated booking status to completed
  if (treatment.booking) {
    const booking = await Booking.findById(treatment.booking);
    if (booking) {
      booking.status = 'completed';
      await booking.save();
    }
  }
  
  res.json(updatedTreatment);
}));

module.exports = router; 