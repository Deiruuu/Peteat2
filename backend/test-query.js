const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();

// Import all required models
require('./models/Pet');
require('./models/User');
const PetTreatment = require('./models/PetTreatment');

async function testQuery() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Get the clinic ID from our previous test
    const clinicId = '685ae92342752bc6f3ccd834';
    
    // Run the same query that the API endpoint would use
    console.log(`Testing query for clinic ID: ${clinicId}`);
    const treatments = await PetTreatment.find({ 
      clinic: clinicId,
      discharged: false
    })
      .populate('petOwner', 'fullName email contactNumber profilePicture')
      .populate('pet', 'name species breed age gender weight profileImage')
      .populate('booking', 'bookingDate appointmentTime reason')
      .sort({ lastUpdate: -1 });
    
    console.log('Query results:', JSON.stringify(treatments, null, 2));
    console.log(`Found ${treatments.length} treatments`);
    
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

testQuery(); 