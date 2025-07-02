const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// 🔧 Storage for pet photos
const petStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const petUpload = multer({
  storage: petStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ✅ Upload-only endpoint for standalone image uploads (MUST come BEFORE `/:id`)
router.post('/upload', petUpload.single('image'), (req, res) => {
  try {
    console.log('Upload endpoint hit with body:', req.body);
    console.log('Upload file:', req.file);
    
    if (!req.file) {
      console.log('No image file detected in the request');
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Build a full URL to the image
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('Generated image URL:', imageUrl);
    
    res.status(200).json({ message: 'Upload successful', imageUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Image upload failed' });
  }
});

// 🐾 Get all pets
router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find().populate('owner', 'fullName email -_id');
    res.json(pets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🐾 Get pets by owner
router.get('/owner/:ownerId', async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.params.ownerId });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const processedPets = pets.map(pet => {
      const petObj = pet.toObject();
      if (petObj.profileImage && !petObj.profileImage.startsWith('http')) {
        petObj.profileImage = `${baseUrl}/${petObj.profileImage.replace(/^\/+/, '')}`;
      }
      return petObj;
    });

    res.json(processedPets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🐾 Get single pet (must come AFTER '/upload')
router.get('/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id).populate('owner', 'fullName email');
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    const petObj = pet.toObject();
    if (petObj.profileImage && !petObj.profileImage.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      petObj.profileImage = `${baseUrl}/${petObj.profileImage.replace(/^\/+/, '')}`;
    }

    res.json(petObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🐾 Create new pet
router.post('/', isAuthenticated, petUpload.single('profileImage'),
  [
    body('owner').notEmpty().withMessage('owner is required'),
    body('name').notEmpty().withMessage('name is required'),
    body('category').notEmpty().withMessage('category is required'),
    body('species').notEmpty().withMessage('species is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { owner, name, category, species, breed, age, gender, weight } = req.body;

    let profileImagePath;
    if (req.file) {
      profileImagePath = `uploads/${req.file.filename}`.replace(/\\/g, '/');
      console.log('New pet profile image:', profileImagePath);
    }

    const newPet = new Pet({
      owner,
      name,
      category,
      species,
      breed,
      age,
      gender,
      weight,
      profileImage: profileImagePath,
    });

    try {
      const savedPet = await newPet.save();

      const petObj = savedPet.toObject();
      if (petObj.profileImage && !petObj.profileImage.startsWith('http')) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        petObj.profileImage = `${baseUrl}/${petObj.profileImage.replace(/^\/+/, '')}`;
      }

      res.status(201).json(petObj);
    } catch (err) {
      console.error('Error creating pet:', err);
      res.status(400).json({ message: err.message });
    }
  });

// 🐾 Update pet info
router.put('/:id', isAuthenticated, petUpload.single('profileImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.file) {
      const relativePath = `uploads/${req.file.filename}`.replace(/\\/g, '/');
      updateData.profileImage = relativePath;
      console.log('Pet profile image uploaded:', relativePath);
    }

    const updatedPet = await Pet.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedPet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    const petObj = updatedPet.toObject();
    if (petObj.profileImage && !petObj.profileImage.startsWith('http')) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      petObj.profileImage = `${baseUrl}/${petObj.profileImage.replace(/^\/+/, '')}`;
    }

    res.json(petObj);
  } catch (err) {
    console.error('Error updating pet:', err);
    res.status(500).json({ message: err.message });
  }
});

// 🐾 Add medical history
router.post('/:id/medical-history', isAuthenticated, async (req, res) => {
  const { date, description, treatment, clinic } = req.body;

  if (!description || !treatment) {
    return res.status(400).json({ message: 'Please provide description and treatment' });
  }

  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    pet.medicalHistory.push({
      date: date || new Date(),
      description,
      treatment,
      clinic
    });

    const updatedPet = await pet.save();
    res.json(updatedPet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🐾 Delete pet
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }
    res.json({ message: 'Pet deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
