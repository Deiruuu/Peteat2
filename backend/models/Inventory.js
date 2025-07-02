const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['medicine', 'equipment', 'supplies', 'food', 'other'],
    required: true
  },
  description: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String, // e.g., boxes, bottles, packs
    required: true
  },
  lowStockThreshold: {
    type: Number,
    default: 5
  },
  price: {
    type: Number,
    min: 0
  },
  barcode: {
    type: String
  },
  expirationDate: {
    type: Date
  },
  manufacturer: {
    type: String
  },
  supplier: {
    type: String
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  location: {
    type: String // Storage location within the clinic
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on change
inventorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for improved query performance
inventorySchema.index({ clinic: 1, itemName: 1 });
inventorySchema.index({ clinic: 1, category: 1 });
inventorySchema.index({ expirationDate: 1 }, { sparse: true });

module.exports = mongoose.model('Inventory', inventorySchema); 