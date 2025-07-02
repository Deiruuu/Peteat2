const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const { isAuthenticated } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Utility to automatically forward async errors to Express error handler
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Get all inventory items for a clinic
router.get('/clinic/:clinicId', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== req.params.clinicId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const inventory = await Inventory.find({ clinic: req.params.clinicId }).sort({ category: 1, itemName: 1 });
  res.json(inventory);
}));

// Get low stock items for a clinic
router.get('/clinic/:clinicId/low-stock', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== req.params.clinicId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const inventory = await Inventory.find({
    clinic: req.params.clinicId,
    $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
  }).sort({ quantity: 1 });
  
  res.json(inventory);
}));

// Get items by category for a clinic
router.get('/clinic/:clinicId/category/:category', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== req.params.clinicId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const inventory = await Inventory.find({
    clinic: req.params.clinicId,
    category: req.params.category
  }).sort({ itemName: 1 });
  
  res.json(inventory);
}));

// Get expiring items for a clinic
router.get('/clinic/:clinicId/expiring', isAuthenticated, asyncHandler(async (req, res) => {
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== req.params.clinicId && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const inventory = await Inventory.find({
    clinic: req.params.clinicId,
    expirationDate: { $ne: null, $lte: thirtyDaysFromNow }
  }).sort({ expirationDate: 1 });
  
  res.json(inventory);
}));

// Get single inventory item
router.get('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id);
  
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== item.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  res.json(item);
}));

// Create new inventory item
router.post('/', isAuthenticated,
  [
    body('clinic').notEmpty().withMessage('clinic is required'),
    body('itemName').notEmpty().withMessage('itemName is required'),
    body('category').notEmpty().isIn(['medicine', 'equipment', 'supplies', 'food', 'other']).withMessage('valid category is required'),
    body('quantity').isNumeric().withMessage('quantity must be a number'),
    body('unit').notEmpty().withMessage('unit is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      clinic, itemName, category, description, quantity, unit,
      lowStockThreshold, price, barcode, expirationDate,
      manufacturer, supplier, location
    } = req.body;
    
    // Check if user is authorized (same clinic or admin)
    if (req.user.id !== clinic && req.user.userType !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Access denied' });
    }
    
    // Check if item with same name already exists for this clinic
    const existingItem = await Inventory.findOne({
      clinic,
      itemName: { $regex: new RegExp(`^${itemName}$`, 'i') } // Case-insensitive match
    });
    
    if (existingItem) {
      return res.status(400).json({ message: 'Item with this name already exists in your inventory' });
    }
    
    const newItem = new Inventory({
      clinic,
      itemName,
      category,
      description,
      quantity,
      unit,
      lowStockThreshold: lowStockThreshold || 5,
      price,
      barcode,
      expirationDate,
      manufacturer,
      supplier,
      location,
      lastRestocked: new Date()
    });
    
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  })
);

// Update inventory item
router.put('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id);
  
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== item.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  // If updating quantity, check if it's a restock
  if (req.body.quantity && req.body.quantity > item.quantity) {
    req.body.lastRestocked = new Date();
  }
  
  const updatedItem = await Inventory.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  
  res.json(updatedItem);
}));

// Update inventory item quantity (increment/decrement)
router.patch('/:id/quantity', isAuthenticated, asyncHandler(async (req, res) => {
  const { change, isRestock } = req.body;
  
  if (change === undefined || typeof change !== 'number') {
    return res.status(400).json({ message: 'Please provide a valid quantity change' });
  }
  
  const item = await Inventory.findById(req.params.id);
  
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== item.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  // Update quantity
  item.quantity += change;
  
  // Prevent negative quantities
  if (item.quantity < 0) {
    item.quantity = 0;
  }
  
  // Update lastRestocked date if this is a restock
  if (isRestock || (change > 0)) {
    item.lastRestocked = new Date();
  }
  
  const updatedItem = await item.save();
  
  res.json(updatedItem);
}));

// Delete inventory item
router.delete('/:id', isAuthenticated, asyncHandler(async (req, res) => {
  const item = await Inventory.findById(req.params.id);
  
  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }
  
  // Check if user is authorized (same clinic or admin)
  if (req.user.id !== item.clinic.toString() && req.user.userType !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized: Access denied' });
  }
  
  await Inventory.findByIdAndDelete(req.params.id);
  
  res.json({ message: 'Inventory item deleted successfully' });
}));

module.exports = router; 