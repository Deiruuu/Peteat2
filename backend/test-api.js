const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();

// Import all required models to ensure they're registered
require('./models/Pet');
require('./models/User');
const PetTreatment = require('./models/PetTreatment');

async function testPetTreatmentModel() {
  try {
    // Connect to MongoDB using the same method as the server
    await connectDB();
    
    // Test finding treatments without populating first
    console.log('Testing PetTreatment.find() without populate');
    const treatmentsRaw = await PetTreatment.find().limit(2);
    console.log('Raw treatments:', JSON.stringify(treatmentsRaw, null, 2));
    
    // Now try with populate
    console.log('\nTesting PetTreatment.find() with populate');
    const treatments = await PetTreatment.find()
      .populate('petOwner', 'fullName email contactNumber')
      .populate('pet', 'name species breed')
      .populate('clinic', 'fullName clinicName')
      .limit(2);
    
    console.log('Found treatments with populate:', JSON.stringify(treatments, null, 2));
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
  }
}

testPetTreatmentModel(); 