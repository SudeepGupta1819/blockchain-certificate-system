const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    getCertificates,
    issueCertificate,
    verifyCertificate,
    verifyCertificateWithPdf,
    revokeCertificate
} = require('../controllers/certificateController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Ensure destination storage directory exists
const uploadDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'certificate-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Issuing (Protected Admin)
router.get('/', protect, adminOnly, getCertificates);
router.post('/', protect, adminOnly, upload.single('file'), issueCertificate);

// Public Verification
router.get('/verify/:certificateId', verifyCertificate);
router.post('/verify/:certificateId', upload.single('file'), verifyCertificateWithPdf);

// Admin Revocation
router.post('/:certificateId/revoke', protect, adminOnly, revokeCertificate);

module.exports = router;
module.exports.verificationUpload = upload.single('file');
