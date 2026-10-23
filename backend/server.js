const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Import database connection (this tests connection on load)
require('./config/db');

// Middleware
app.use(cors());
app.use(express.json());

// Import Routes & Controllers
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const verificationLogRoutes = require('./routes/verificationLogRoutes');
const { verifyCertificate, verifyCertificateWithPdf } = require('./controllers/certificateController');

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "Certificate Verification API is running"
  });
});

// Direct public verification endpoint
app.get('/api/verify/:certificateId', verifyCertificate);
app.post('/api/verify/:certificateId', certificateRoutes.verificationUpload, verifyCertificateWithPdf);

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/verification-logs', verificationLogRoutes);

app.use((error, req, res, next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body. Please check the request format and try again.'
    });
  }

  next(error);
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
