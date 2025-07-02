const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();
const User = require('./models/User');

async function listUsers() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Connected to MongoDB');
    
    // Find clinic users
    console.log('Finding clinic users...');
    const clinics = await User.find({ userType: 'clinic' })
      .select('email fullName clinicName userType')
      .limit(5);
    
    console.log('Clinic users:', JSON.stringify(clinics, null, 2));
    
    // Find pet owner users
    console.log('\nFinding pet owner users...');
    const petOwners = await User.find({ userType: 'pet_owner' })
      .select('email fullName userType')
      .limit(5);
    
    console.log('Pet owner users:', JSON.stringify(petOwners, null, 2));
    
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

listUsers(); 