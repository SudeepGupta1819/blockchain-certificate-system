const express = require('express');
const router = express.Router();
const {
    sendOtp,
    verifyOtp,
    register,
    login,
    getMe
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
