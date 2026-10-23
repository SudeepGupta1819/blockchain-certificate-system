const db = require('../config/db');

// @desc    Fetch all student records
// @route   GET /api/students
// @access  Private (Admin)
const getStudents = async (req, res) => {
    try {
        const [students] = await db.execute(
            'SELECT id, student_id AS studentId, course, department, graduation_year AS graduationYear FROM students WHERE owner_admin_id = ? ORDER BY id DESC',
            [req.user.id]
        );

        res.json({
            success: true,
            students
        });
    } catch (error) {
        console.error('Get Students Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching students' });
    }
};

// @desc    Create a new student record (for certificate association)
// @route   POST /api/students
// @access  Private (Admin)
const createStudent = async (req, res) => {
    try {
        const { studentId, course, department, graduationYear } = req.body;

        if (!studentId || !course || !department || !graduationYear) {
            return res.status(400).json({
                success: false,
                message: 'Please provide studentId, course, department, and graduationYear'
            });
        }

        // Check if studentId already exists
        const [existing] = await db.execute('SELECT id FROM students WHERE student_id = ?', [studentId]);
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Student with this studentId already exists'
            });
        }

        // Insert student record
        const [result] = await db.execute(
            'INSERT INTO students (owner_admin_id, student_id, course, department, graduation_year) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, studentId, course, department, Number(graduationYear)]
        );

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            student: {
                id: result.insertId,
                ownerAdminId: req.user.id,
                studentId,
                course,
                department,
                graduationYear: Number(graduationYear)
            }
        });
    } catch (error) {
        console.error('Create Student Error:', error);
        res.status(500).json({ success: false, message: 'Server error creating student record' });
    }
};

module.exports = {
    getStudents,
    createStudent
};
