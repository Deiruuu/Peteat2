const express = require('express');
const router = express.Router();
const NFCTag = require('../models/NFCTag');
const Pet = require('../models/Pet');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Utility to automatically forward async errors to Express error handler
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get all NFC tags
router.get('/', isAuthenticated, asyncHandler(async (req, res) => {
  // Admin only can see all tags
  if (req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Admin access only' });
  }
  
  const tags = await NFCTag.find().populate('pet', 'name species breed');
  res.json(tags);
}));

// Get NFC tags by pet owner
router.get('/owner/:ownerId', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same user or admin)
  if (req.user.id !== req.params.ownerId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  // First get all pets owned by this user
  const pets = await Pet.find({ owner: req.params.ownerId }, '_id');
  const petIds = pets.map(pet => pet._id);
  
  // Then find all NFC tags associated with these pets
  const tags = await NFCTag.find({ pet: { $in: petIds } })
    .populate('pet', 'name species breed profileImage')
    .sort({ createdAt: -1 });
  
  res.json(tags);
}));

// Get lost pets
router.get('/lost-pets', asyncHandler(async (req, res) => {
  // This endpoint is public as it helps with lost pet recovery
  const lostPets = await NFCTag.find({ isLostPet: true })
    .populate('pet', 'name species breed age gender profileImage owner')
    .populate({
      path: 'pet',
      populate: {
        path: 'owner',
        select: 'fullName contactNumber email address'
      }
    });
  
  res.json(lostPets);
}));

// Get single NFC tag by ID
router.get('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const tag = await NFCTag.findById(req.params.id)
    .populate('pet', 'name species breed age gender profileImage owner')
    .populate({
      path: 'pet',
      populate: {
        path: 'owner',
        select: 'fullName contactNumber email address'
      }
    });
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Check if user is authorized (pet owner, admin)
  const petOwner = tag.pet?.owner?._id?.toString();
  if (req.user.id !== petOwner && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  res.json(tag);
}));

// Get tag by NFC ID (public endpoint for scanning)
router.get('/tag/:tagId', asyncHandler(async (req, res) => {
  const tag = await NFCTag.findOne({ tagId: req.params.tagId })
    .populate('pet', 'name species breed age gender profileImage owner')
    .populate({
      path: 'pet',
      populate: {
        path: 'owner',
        select: 'fullName contactNumber email' // Don't expose full address for privacy
      }
    });
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Update scan count and timestamp
  tag.lastScannedAt = new Date();
  tag.scanCount += 1;
  
  // If coordinates provided in query, update lastScanLocation
  if (req.query.longitude && req.query.latitude) {
    tag.lastScanLocation = {
      type: 'Point',
      coordinates: [parseFloat(req.query.longitude), parseFloat(req.query.latitude)]
    };
  }
  
  await tag.save();
  
  // For privacy, only return limited owner info if pet is not marked as lost
  if (!tag.isLostPet) {
    // Remove sensitive owner info
    const safeTag = tag.toObject();
    if (safeTag.pet && safeTag.pet.owner) {
      safeTag.pet.owner = {
        fullName: safeTag.pet.owner.fullName
        // Contact info excluded unless pet is lost
      };
    }
    return res.json(safeTag);
  }
  
  // Return full info for lost pets to help with recovery
  res.json(tag);
}));

// Register new NFC tag
router.post('/', isAuthenticated,
  [
    body('tagId').notEmpty().withMessage('tagId is required'),
    body('pet').notEmpty().withMessage('pet is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { tagId, pet, isActive } = req.body;
    
    // Check if tag ID already exists
    const existingTag = await NFCTag.findOne({ tagId });
    if (existingTag) {
      return res.status(400).json({ message: 'NFC tag ID already registered' });
    }
    
    // Verify pet exists and belongs to the user
    const petDoc = await Pet.findById(pet);
    if (!petDoc) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    
    // Check if user is authorized (pet owner or admin)
    if (req.user.id !== petDoc.owner.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Not pet owner' });
    }
    
    const newTag = new NFCTag({
      tagId,
      pet,
      isActive: isActive !== undefined ? isActive : true
    });
    
    const savedTag = await newTag.save();
    res.status(201).json(savedTag);
  })
);

// Report lost pet
router.post('/:id/report-lost', isAuthenticated, asyncHandler(async (req, res) => {
  const tag = await NFCTag.findById(req.params.id).populate('pet');
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Check if user is authorized (pet owner or admin)
  const pet = await Pet.findById(tag.pet);
  if (!pet) {
    return res.status(404).json({ message: 'Associated pet not found' });
  }
  
  if (req.user.id !== pet.owner.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Not pet owner' });
  }
  
  const { lastSeenLocation, additionalInfo } = req.body;
  
  tag.isLostPet = true;
  tag.lostPetDetails = {
    dateReported: new Date(),
    lastSeenLocation: lastSeenLocation || '',
    contactDetails: req.body.contactDetails || '',
    additionalInfo: additionalInfo || ''
  };
  
  const updatedTag = await tag.save();
  res.json(updatedTag);
}));

// Mark pet as found
router.post('/:id/mark-found', isAuthenticated, asyncHandler(async (req, res) => {
  const tag = await NFCTag.findById(req.params.id);
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Check if user is authorized (pet owner or admin)
  const pet = await Pet.findById(tag.pet);
  if (!pet) {
    return res.status(404).json({ message: 'Associated pet not found' });
  }
  
  if (req.user.id !== pet.owner.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Not pet owner' });
  }
  
  tag.isLostPet = false;
  tag.lostPetDetails = undefined;
  
  const updatedTag = await tag.save();
  res.json(updatedTag);
}));

// Update NFC tag
router.put('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const tag = await NFCTag.findById(req.params.id);
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Check if user is authorized (pet owner or admin)
  const pet = await Pet.findById(tag.pet);
  if (!pet) {
    return res.status(404).json({ message: 'Associated pet not found' });
  }
  
  if (req.user.id !== pet.owner.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Not pet owner' });
  }
  
  // Don't allow changing the tagId via update
  const { tagId, ...updateData } = req.body;
  
  const updatedTag = await NFCTag.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );
  
  res.json(updatedTag);
}));

// Delete NFC tag
router.delete('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const tag = await NFCTag.findById(req.params.id);
  
  if (!tag) {
    return res.status(404).json({ message: 'Tag not found' });
  }
  
  // Check if user is authorized (pet owner or admin)
  const pet = await Pet.findById(tag.pet);
  if (!pet) {
    return res.status(404).json({ message: 'Associated pet not found' });
  }
  
  if (req.user.id !== pet.owner.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Not pet owner' });
  }
  
  await NFCTag.findByIdAndDelete(req.params.id);
  
  res.json({ message: 'NFC tag deleted successfully' });
}));

module.exports = router; 