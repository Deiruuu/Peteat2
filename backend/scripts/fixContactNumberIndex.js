/**
 * Script to fix the contactNumber index issue
 * This script will:
 * 1. Check if there is a unique index on contactNumber
 * 2. Drop that index if it exists
 * 3. Create a new sparse unique index if needed
 * 
 * Run this script once with: node scripts/fixContactNumberIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Get the MongoDB URI from environment variables
const dbURI = process.env.MONGO_URI;

async function fixContactNumberIndex() {
  try {
    // Check if we have a MongoDB URI
    if (!dbURI) {
      throw new Error("MongoDB URI is not defined. Please check your .env file and make sure MONGO_URI is set.");
    }
    
    console.log("Connecting to MongoDB...");
    
    // Connect to MongoDB
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');
    
    // Get connection and collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get existing indexes
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes);
    
    // Check if contactNumber index exists
    const contactNumberIndex = indexes.find(index => 
      index.key && index.key.contactNumber === 1
    );
    
    if (contactNumberIndex) {
      console.log('Found contactNumber index:', contactNumberIndex);
      
      // Drop the existing index
      console.log('Dropping contactNumber index...');
      await usersCollection.dropIndex(contactNumberIndex.name);
      console.log('Index dropped successfully');
      
      // Create new sparse index
      console.log('Creating new sparse unique index on contactNumber...');
      await usersCollection.createIndex(
        { contactNumber: 1 }, 
        { 
          unique: true, 
          sparse: true,
          background: true
        }
      );
      console.log('New sparse unique index created successfully');
    } else {
      console.log('No problematic contactNumber index found');
      
      // Create sparse index if needed
      console.log('Creating sparse unique index on contactNumber...');
      await usersCollection.createIndex(
        { contactNumber: 1 }, 
        { 
          unique: true, 
          sparse: true,
          background: true
        }
      );
      console.log('Sparse unique index created successfully');
    }
    
    // Verify the fix
    const updatedIndexes = await usersCollection.indexes();
    console.log('Updated indexes:', updatedIndexes);
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    console.log('Index fix completed successfully');
  } catch (error) {
    console.error('Error fixing contactNumber index:', error);
  }
}

// Run the function
fixContactNumberIndex(); 