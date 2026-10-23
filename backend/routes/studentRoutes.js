const express = require('express');
const router = express.Router();
const { getStudents, createStudent } = require('../controllers/studentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, adminOnly, getStudents);
router.post('/', protect, adminOnly, createStudent);

module.exports = router;
