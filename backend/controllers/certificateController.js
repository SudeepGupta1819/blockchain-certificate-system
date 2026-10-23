const fs = require('fs');
const db = require('../config/db');
const { generateCertificateHash } = require('../services/hashService');
const {
    issueCertificateOnChain,
    verifyCertificateOnChain,
    revokeCertificateOnChain
} = require('../services/blockchainService');

const logVerification = async (certificateId, result) => {
    try {
        await db.execute(
            'INSERT INTO verification_logs (certificate_id, result) VALUES (?, ?)',
            [certificateId, result]
        );
    } catch (error) {
        // Logging must not hide the verification result from the public endpoint.
        console.error('Failed to insert verification log:', error.code || 'unknown error');
    }
};

// @desc    Fetch all certificate records
// @route   GET /api/certificates
// @access  Private (Admin)
const getCertificates = async (req, res) => {
    try {
        const [certificates] = await db.execute(
            `SELECT c.id,
                    c.certificate_id AS certificateId,
                    s.student_id AS studentId,
                    s.course,
                    s.department,
                    c.title,
                    c.certificate_type AS certificateType,
                    c.issue_date AS issueDate,
                    c.certificate_hash AS certificateHash,
                    c.blockchain_tx_hash AS blockchainTxHash,
                    c.status,
                    c.created_at AS createdAt
             FROM certificates c
             INNER JOIN students s ON c.student_id = s.id
             WHERE s.owner_admin_id = ?
             ORDER BY c.id DESC`, [req.user.id]
        );

        res.json({
            success: true,
            certificates
        });
    } catch (error) {
        console.error('Get Certificates Error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching certificates' });
    }
};

// @desc    Issue a new certificate (PDF upload -> SHA-256 -> DB -> Blockchain -> DB update)
// @route   POST /api/certificates
// @access  Private (Admin)
const issueCertificate = async (req, res) => {
    let insertedCertId = null;
    let preservePendingRecord = false;

    try {
        const { certificateId, studentId, title, certificateType, issueDate } = req.body;

        // 1. Validate PDF upload
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF file for the certificate'
            });
        }

        const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only PDF uploads are allowed'
            });
        }

        // 2. Validate required metadata fields
        if (!certificateId || !studentId || !title || !certificateType || !issueDate) {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Please provide certificateId, studentId, title, certificateType, and issueDate'
            });
        }

        // 3. Calculate SHA-256 hash of actual file bytes
        const fileBuffer = fs.readFileSync(req.file.path);
        const certificateHash = generateCertificateHash(fileBuffer);

        // 4. Check for duplicate certificate ID
        const [existingCert] = await db.execute(
            'SELECT id FROM certificates WHERE certificate_id = ?',
            [certificateId]
        );
        if (existingCert.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Certificate ID already exists. Revoked certificate IDs cannot be reused. Please use a new Certificate ID.'
            });
        }

        // 5. Verify referencing student exists
        const [students] = await db.execute(
            'SELECT id FROM students WHERE (id = ? OR student_id = ?) AND owner_admin_id = ?',
            [studentId, studentId, req.user.id]
        );
        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        const studentPrimaryId = students[0].id;

        // 6. Insert initial record into MySQL
        const [dbResult] = await db.execute(
            'INSERT INTO certificates (certificate_id, student_id, title, certificate_type, issue_date, certificate_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [certificateId, studentPrimaryId, title, certificateType, issueDate, certificateHash, 'PENDING']
        );
        insertedCertId = dbResult.insertId;

        // 7. Write to Local Blockchain
        let txHash;
        try {
            txHash = await issueCertificateOnChain(certificateId, certificateHash);
            preservePendingRecord = true;
        } catch (blockchainError) {
            console.error('Blockchain issue transaction failed:', blockchainError.code || 'unknown error');
            if (blockchainError.transactionConfirmed || blockchainError.transactionSubmitted) {
                preservePendingRecord = true;
                if (blockchainError.transactionHash) {
                    await db.execute(
                        'UPDATE certificates SET blockchain_tx_hash = ? WHERE id = ?',
                        [blockchainError.transactionHash, insertedCertId]
                    );
                }
            } else if (insertedCertId) {
                await db.execute('DELETE FROM certificates WHERE id = ?', [insertedCertId]);
            }
            return res.status(500).json({
                success: false,
                message: `Blockchain transaction failed: ${blockchainError.message || 'issuance could not be confirmed'}`
            });
        }

        // 8. Mark the certificate valid only after receipt and read-back confirmation.
        await db.execute(
            'UPDATE certificates SET blockchain_tx_hash = ?, status = ? WHERE id = ?',
            [txHash, 'VALID', insertedCertId]
        );

        // 9. Respond with success
        res.status(201).json({
            success: true,
            message: 'Certificate issued and recorded on blockchain successfully',
            certificate: {
                id: insertedCertId,
                certificateId,
                studentId: studentPrimaryId,
                title,
                certificateType,
                issueDate,
                certificateHash,
                blockchainTxHash: txHash,
                status: 'VALID',
                filePath: req.file.path
            }
        });

    } catch (error) {
        console.error('Issue Certificate Error:', error);
        if (insertedCertId && !preservePendingRecord) {
            try {
                await db.execute('DELETE FROM certificates WHERE id = ?', [insertedCertId]);
            } catch (cleanupErr) {
                console.error('Cleanup DB rollback error:', cleanupErr.message);
            }
        } else if (insertedCertId) {
            console.error('Blockchain transaction needs confirmation; leaving the certificate pending for reconciliation.');
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while issuing certificate'
        });
    }
};

// @desc    Public verification of a certificate by certificateId
// @route   GET /api/verify/:certificateId or /api/certificates/verify/:certificateId
// @access  Public
const verifyCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        if (!certificateId) {
            return res.status(400).json({ success: false, message: 'Certificate ID is required' });
        }

        // 1. Search MySQL certificates table
        const [rows] = await db.execute(
            'SELECT id, certificate_id, title, certificate_type, issue_date, certificate_hash, status, blockchain_tx_hash FROM certificates WHERE certificate_id = ?',
            [certificateId]
        );

        // 2. If certificate does not exist in DB
        if (rows.length === 0) {
            await logVerification(null, 'NOT_FOUND');

            return res.status(404).json({
                success: false,
                result: 'NOT_FOUND',
                message: 'Certificate not found in database'
            });
        }

        const dbCert = rows[0];

        // 3. Query blockchain for certificate verification
        const onChain = await verifyCertificateOnChain(certificateId);

        // 4. Compare status and hashes
        let result = 'INVALID';
        let hashMatch = false;
        let reason = 'Certificate hash does not match the blockchain record';

        if (dbCert.status === 'REVOKED' || (onChain.exists && onChain.revoked)) {
            result = 'REVOKED';
            hashMatch = onChain.exists && (dbCert.certificate_hash === onChain.certificateHash);
        } else if (!onChain.exists) {
            result = 'INVALID';
            hashMatch = false;
            reason = onChain.reason === 'NOT_FOUND'
                ? 'Certificate does not exist on the blockchain'
                : 'Blockchain certificate could not be verified';
        } else if (dbCert.certificate_hash === onChain.certificateHash) {
            result = 'VALID';
            hashMatch = true;
            reason = null;
        } else {
            result = 'INVALID';
            hashMatch = false;
        }

        // 5. Insert verification_logs entry into MySQL
        await logVerification(dbCert.id, result);

        // 6. Return response
        return res.status(200).json({
            success: result === 'VALID',
            result,
            certificate: {
                certificateId: dbCert.certificate_id,
                title: dbCert.title,
                certificateType: dbCert.certificate_type,
                issueDate: dbCert.issue_date,
                status: dbCert.status
            },
            blockchain: {
                issuer: onChain.issuer || null,
                issuedAt: onChain.issuedAt || 0,
                revoked: onChain.revoked || false
            },
            hashMatch,
            reason
        });

    } catch (error) {
        console.error('Verify Certificate Error:', error.code || 'unknown error');
        return res.status(500).json({
            success: false,
            message: 'Server error verifying certificate'
        });
    }
};

// @desc    Public verification of a certificate ID and uploaded PDF
// @route   POST /api/verify/:certificateId
// @access  Public
const verifyCertificateWithPdf = async (req, res) => {
    const uploadedFilePath = req.file?.path;

    try {
        const { certificateId } = req.params;

        if (!certificateId) {
            return res.status(400).json({ success: false, message: 'Certificate ID is required' });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a PDF file for verification'
            });
        }

        const isPdf = req.file.mimetype === 'application/pdf'
            || req.file.originalname.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only PDF uploads are allowed'
            });
        }

        const uploadedPdfHash = generateCertificateHash(fs.readFileSync(req.file.path));
        const [rows] = await db.execute(
            'SELECT id, certificate_id, title, certificate_type, issue_date, certificate_hash, status FROM certificates WHERE certificate_id = ?',
            [certificateId]
        );

        if (rows.length === 0) {
            await logVerification(null, 'NOT_FOUND');
            return res.status(404).json({
                success: false,
                result: 'NOT_FOUND',
                message: 'Certificate not found in database'
            });
        }

        const dbCert = rows[0];
        const onChain = await verifyCertificateOnChain(certificateId);
        const isRevoked = dbCert.status === 'REVOKED' || (onChain.exists && onChain.revoked);
        const uploadedHashMatch = onChain.exists && uploadedPdfHash === onChain.certificateHash;
        const databaseHashMatch = onChain.exists && dbCert.certificate_hash === onChain.certificateHash;
        const result = isRevoked
            ? 'REVOKED'
            : onChain.exists && uploadedHashMatch && databaseHashMatch
                ? 'VALID'
                : 'INVALID';
        const reason = result === 'VALID'
            ? null
            : isRevoked
                ? 'Certificate has been revoked'
                : !onChain.exists
                    ? onChain.reason === 'NOT_FOUND'
                        ? 'Certificate does not exist on the blockchain'
                        : 'Blockchain certificate could not be verified'
                    : !uploadedHashMatch
                        ? 'Uploaded PDF hash does not match the blockchain record'
                        : 'Certificate hash does not match the blockchain record';

        await logVerification(dbCert.id, result);

        return res.status(200).json({
            success: result === 'VALID',
            result,
            certificate: {
                certificateId: dbCert.certificate_id,
                title: dbCert.title,
                certificateType: dbCert.certificate_type,
                issueDate: dbCert.issue_date,
                status: dbCert.status
            },
            blockchain: {
                issuer: onChain.issuer || null,
                issuedAt: onChain.issuedAt || 0,
                revoked: onChain.revoked || false
            },
            uploadedHashMatch,
            databaseHashMatch,
            reason
        });
    } catch (error) {
        console.error('Verify Certificate PDF Error:', error.code || 'unknown error');
        return res.status(500).json({
            success: false,
            message: 'Server error verifying certificate PDF'
        });
    } finally {
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            try {
                fs.unlinkSync(uploadedFilePath);
            } catch (cleanupError) {
                console.error('Failed to remove verification upload:', cleanupError.message);
            }
        }
    }
};

// @desc    Admin revocation of a certificate
// @route   POST /api/certificates/:certificateId/revoke
// @access  Private (Admin)
const revokeCertificate = async (req, res) => {
    try {
        const { certificateId } = req.params;

        if (!certificateId) {
            return res.status(400).json({ success: false, message: 'Certificate ID is required' });
        }

        // 1. Find certificate in MySQL
        const [rows] = await db.execute(
            'SELECT c.id, c.status FROM certificates c INNER JOIN students s ON s.id = c.student_id WHERE c.certificate_id = ? AND s.owner_admin_id = ?',
            [certificateId, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Certificate not found' });
        }

        const dbCert = rows[0];

        // 2. Verify it is not already revoked
        if (dbCert.status === 'REVOKED') {
            return res.status(400).json({
                success: false,
                message: `Certificate '${certificateId}' is already revoked`
            });
        }

        // 3. Call blockchain revokeCertificate()
        let txHash;
        try {
            txHash = await revokeCertificateOnChain(certificateId);
        } catch (bcError) {
            console.error('Blockchain revocation failed:', bcError.code || 'unknown error');
            if (bcError.code === 'CERTIFICATE_ALREADY_REVOKED') {
                return res.status(400).json({
                    success: false,
                    message: `Certificate '${certificateId}' is already revoked on the blockchain`
                });
            }

            return res.status(503).json({
                success: false,
                message: 'Blockchain revocation failed. MySQL certificate status was not changed.'
            });
        }

        // 4. Update MySQL status to REVOKED
        await db.execute(
            'UPDATE certificates SET status = ? WHERE id = ?',
            ['REVOKED', dbCert.id]
        );

        // 5. Respond with success
        return res.json({
            success: true,
            message: 'Certificate revoked successfully',
            certificateId,
            status: 'REVOKED',
            blockchainTxHash: txHash
        });

    } catch (error) {
        console.error('Revoke Certificate Error:', error.code || 'unknown error');
        return res.status(500).json({
            success: false,
            message: 'Server error revoking certificate'
        });
    }
};

// @desc    Get all verification logs
// @route   GET /api/verification-logs
// @access  Private (Admin)
const getVerificationLogs = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                vl.id, 
                vl.verified_at, 
                vl.result, 
                c.certificate_id
            FROM verification_logs vl
            INNER JOIN certificates c ON vl.certificate_id = c.id
            INNER JOIN students s ON c.student_id = s.id
            WHERE s.owner_admin_id = ?
            ORDER BY vl.verified_at DESC
        `, [req.user.id]);

        return res.status(200).json({
            success: true,
            logs: rows
        });
    } catch (error) {
        console.error('Get Verification Logs Error:', error.code || 'unknown error');
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving verification logs'
        });
    }
};

module.exports = {
    getCertificates,
    issueCertificate,
    verifyCertificate,
    verifyCertificateWithPdf,
    revokeCertificate,
    getVerificationLogs
};
