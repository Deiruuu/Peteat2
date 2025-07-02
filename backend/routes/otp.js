const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Route for requesting an OTP
router.post('/request', otpController.requestOtp);

// Route for verifying an OTP
router.post('/verify', otpController.verifyOtp);

// Route for resetting password with OTP
router.post('/reset-password', otpController.resetPassword);

module.exports = router; 