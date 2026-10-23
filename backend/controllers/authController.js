const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendOtpEmail } = require('../services/emailService');

// Ensure email_otps table exists
const ensureOtpTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS email_otps (
                id INT PRIMARY KEY AUTO_INCREMENT,
                email VARCHAR(150) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                attempts INT DEFAULT 0,
                is_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_token (verification_token)
            )
        `);
    } catch (err) {
        // Table initialization helper
    }
};

// Initialize table on load
ensureOtpTable();

const hashOtp = (otp) => {
    const salt = process.env.JWT_SECRET || 'blockchain_certificate_otp_salt';
    return crypto.createHash('sha256').update(String(otp) + salt).digest('hex');
};

const isStrongPassword = (password) => typeof password === 'string'
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password);

// @desc    Send 6-digit verification code to email
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
    try {
        const { email: rawEmail } = req.body;

        if (!rawEmail) {
            return res.status(400).json({ success: false, message: 'Please provide an email address' });
        }

        const email = String(rawEmail).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address format' });
        }

        // 1. Check if user already exists
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists with this email address' });
        }

        await ensureOtpTable();

        // 2. Check 60-second cooldown on repeated requests
        const [recentRequests] = await db.execute(
            'SELECT created_at FROM email_otps WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY created_at DESC LIMIT 1',
            [email]
        );
        if (recentRequests.length > 0) {
            return res.status(429).json({
                success: false,
                message: 'Please wait 60 seconds before requesting another verification code.'
            });
        }

        // 3. Check rate limit: maximum 5 requests per hour per email
        const [hourlyRequests] = await db.execute(
            'SELECT COUNT(*) as count FROM email_otps WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
            [email]
        );
        if (hourlyRequests[0] && hourlyRequests[0].count >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many verification code requests for this email. Please try again after 1 hour.'
            });
        }

        // 4. Generate cryptographically secure 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();
        const otpHash = hashOtp(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Invalidate older unverified challenges for this email
        await db.execute('DELETE FROM email_otps WHERE email = ? AND is_verified = FALSE', [email]);

        // Insert new challenge
        await db.execute(
            'INSERT INTO email_otps (email, otp_hash, expires_at) VALUES (?, ?, ?)',
            [email, otpHash, expiresAt]
        );

        // 5. Send email via Nodemailer SMTP
        try {
            await sendOtpEmail({ to: email, otp });
        } catch (mailError) {
            // Remove challenge if email delivery failed
            await db.execute('DELETE FROM email_otps WHERE email = ? AND otp_hash = ?', [email, otpHash]);
            return res.status(503).json({
                success: false,
                message: mailError.message || 'Failed to deliver OTP email. Please verify SMTP settings.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'A 6-digit verification code has been sent to your email.'
        });

    } catch (error) {
        console.error('Send OTP Error:', error);
        return res.status(500).json({ success: false, message: 'Server error generating verification code' });
    }
};

// @desc    Verify 6-digit email OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
    try {
        const { email: rawEmail, otp: rawOtp } = req.body;

        if (!rawEmail || !rawOtp) {
            return res.status(400).json({ success: false, message: 'Email and verification code are required' });
        }

        const email = String(rawEmail).trim().toLowerCase();
        const otp = String(rawOtp).trim();

        await ensureOtpTable();

        // 1. Fetch latest unverified challenge for email
        const [challenges] = await db.execute(
            'SELECT id, otp_hash, expires_at, attempts FROM email_otps WHERE email = ? AND is_verified = FALSE ORDER BY id DESC LIMIT 1',
            [email]
        );

        if (challenges.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No active verification code found for this email. Please request a new code.'
            });
        }

        const challenge = challenges[0];

        // 2. Check if expired (5 minutes)
        if (new Date(challenge.expires_at).getTime() < Date.now()) {
            await db.execute('DELETE FROM email_otps WHERE id = ?', [challenge.id]);
            return res.status(400).json({
                success: false,
                message: 'Verification code has expired. Please request a new code.'
            });
        }

        // 3. Check attempt limit (max 5)
        if (challenge.attempts >= 5) {
            await db.execute('DELETE FROM email_otps WHERE id = ?', [challenge.id]);
            return res.status(400).json({
                success: false,
                message: 'Maximum attempts exceeded for this code. Please request a new code.'
            });
        }

        // 4. Compare hash
        const inputHash = hashOtp(otp);
        if (inputHash !== challenge.otp_hash) {
            const newAttempts = challenge.attempts + 1;
            await db.execute('UPDATE email_otps SET attempts = ? WHERE id = ?', [newAttempts, challenge.id]);
            const remaining = 5 - newAttempts;
            return res.status(400).json({
                success: false,
                message: remaining > 0
                    ? `Incorrect verification code. ${remaining} attempt(s) remaining.`
                    : 'Maximum attempts exceeded. Please request a new code.'
            });
        }

        // 5. Successful verification -> generate single-use verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        await db.execute(
            'UPDATE email_otps SET is_verified = TRUE, verification_token = ? WHERE id = ?',
            [verificationToken, challenge.id]
        );

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            verificationToken
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({ success: false, message: 'Server error during OTP verification' });
    }
};

// @desc    Register new admin (requires verified OTP)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email: rawEmail, password, verificationToken, otp } = req.body;

        if (!name || !rawEmail || !password) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number. Special characters are optional.'
            });
        }

        const email = String(rawEmail).trim().toLowerCase();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // Check if user exists
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        await ensureOtpTable();

        // Verify OTP challenge was completed
        let verifiedRecordId = null;

        if (verificationToken) {
            // Check verification token verified within the last 15 minutes
            const [tokens] = await db.execute(
                'SELECT id FROM email_otps WHERE email = ? AND verification_token = ? AND is_verified = TRUE AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE) ORDER BY id DESC LIMIT 1',
                [email, verificationToken]
            );
            if (tokens.length > 0) {
                verifiedRecordId = tokens[0].id;
            }
        } else if (otp) {
            // Direct OTP validation in register call
            const inputHash = hashOtp(otp);
            const [otps] = await db.execute(
                'SELECT id, otp_hash, expires_at, attempts FROM email_otps WHERE email = ? AND is_verified = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
                [email]
            );
            if (otps.length > 0 && otps[0].otp_hash === inputHash && otps[0].attempts < 5) {
                verifiedRecordId = otps[0].id;
            }
        }

        if (!verifiedRecordId) {
            return res.status(400).json({
                success: false,
                message: 'Email address has not been verified. Please complete OTP verification first.'
            });
        }

        // Consume OTP record immediately so it cannot be reused
        await db.execute('DELETE FROM email_otps WHERE id = ?', [verifiedRecordId]);

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert new user
        const [result] = await db.execute(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, email, passwordHash, 'ADMIN']
        );

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            user: {
                id: result.insertId,
                name,
                email,
                role: 'ADMIN'
            }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email: rawEmail, password } = req.body;

        if (!rawEmail || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const email = String(rawEmail).trim().toLowerCase();

        // Find user
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'supersecret',
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

// @desc    Get current user info
// @route   GET /api/auth/me
// @access  Private (Admin)
const getMe = async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, name, email, role, created_at FROM users WHERE id = ?', 
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error('GetMe Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user info' });
    }
};

module.exports = {
    sendOtp,
    verifyOtp,
    register,
    login,
    getMe
};
