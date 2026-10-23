const express = require('express');
const router = express.Router();
const { getVerificationLogs } = require('../controllers/certificateController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, adminOnly, getVerificationLogs);

module.exports = router;
