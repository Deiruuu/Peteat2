const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Using Gmail as the email service
    auth: {
        user: process.env.EMAIL_USER || 'PRLD.PetEat@gmail.com',
        pass: process.env.EMAIL_PASS || 'ytpk xszd ixhj edvx',
    },
});

exports.requestOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
        
        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        user.otp = otp;
        user.otpExpires = otpExpires;
        await user.save();
        
        // Send OTP email
        await transporter.sendMail({
            from: process.env.EMAIL_USER || 'PRLD.PetEat@gmail.com',
            to: user.email,
            subject: 'Your PetEat Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #4CAF50;">PetEat Verification Code</h2>
                    </div>
                    <div style="margin-bottom: 30px;">
                        <p>Hello ${user.fullName},</p>
                        <p>Thank you for registering with PetEat. To verify your account, please use the following verification code:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0; border-radius: 4px;">
                            <strong>${otp}</strong>
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you did not request this code, please ignore this email.</p>
                    </div>
                    <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <p>© 2024 PetEat. All rights reserved.</p>
                    </div>
                </div>
            `
        });
        
        res.json({ success: true, message: 'Verification code sent to your email' });
    } catch (err) {
        console.error('OTP Request Error:', err);
        res.status(500).json({ success: false, message: 'Error sending verification code' });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and verification code are required' });
        
        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({ success: false, message: 'No verification code requested' });
        }
        
        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid verification code' });
        }
        
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification code expired' });
        }
        
        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        
        // For pet owners, automatically approve them
        // For vet clinics, keep them pending approval
        if (user.userType !== 'clinic') {
            // This is a pet owner - they are automatically approved
            await user.save();
            res.json({ 
                success: true, 
                message: 'Verification successful! You can now login to your account.',
                userType: 'pet_owner',
                requiresApproval: false
            });
        } else {
            // This is a vet clinic - they need approval
            await user.save();
            res.json({ 
                success: true, 
                message: 'Verification successful! Please wait for PetEat team approval.',
                userType: 'vet_clinic',
                requiresApproval: true
            });
        }
    } catch (err) {
        console.error('OTP Verification Error:', err);
        res.status(500).json({ success: false, message: 'Error verifying code' });
    }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required' });
        }
        
        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({ success: false, message: 'No verification code requested' });
        }
        
        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid verification code' });
        }
        
        if (user.otpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification code expired' });
        }
        
        // Use bcrypt to hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.otp = null;
        user.otpExpires = null;
        await user.save();
        
        res.json({ success: true, message: 'Password reset successful' });
    } catch (err) {
        console.error('Password Reset Error:', err);
        res.status(500).json({ success: false, message: 'Error resetting password' });
    }
}; 