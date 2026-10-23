const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = require.resolve('../config/db');
const blockchainServicePath = require.resolve('../services/blockchainService');
const controllerPath = require.resolve('../controllers/certificateController');
const studentControllerPath = require.resolve('../controllers/studentController');
const { adminOnly } = require('../middleware/authMiddleware');
const { createBlockchainService } = require('../services/blockchainService');

const createResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

const loadController = (db, blockchainService) => {
    const originalDb = require.cache[dbPath];
    const originalBlockchainService = require.cache[blockchainServicePath];

    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    require.cache[blockchainServicePath] = {
        id: blockchainServicePath,
        filename: blockchainServicePath,
        loaded: true,
        exports: blockchainService
    };
    delete require.cache[controllerPath];
    const controller = require('../controllers/certificateController');

    if (originalDb) require.cache[dbPath] = originalDb;
    else delete require.cache[dbPath];
    if (originalBlockchainService) require.cache[blockchainServicePath] = originalBlockchainService;
    else delete require.cache[blockchainServicePath];

    return controller;
};

const loadStudentController = (db) => {
    const originalDb = require.cache[dbPath];
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[studentControllerPath];
    const controller = require('../controllers/studentController');
    if (originalDb) require.cache[dbPath] = originalDb;
    else delete require.cache[dbPath];
    return controller;
};

test('student listing scopes the query to the authenticated admin', async () => {
    const calls = [];
    const db = { async execute(sql, params) { calls.push({ sql, params }); return [[{ id: 1 }]]; } };
    const { getStudents } = loadStudentController(db);
    const res = createResponse();

    await getStudents({ user: { id: 22 } }, res);

    assert.match(calls[0].sql, /WHERE owner_admin_id = \?/);
    assert.deepEqual(calls[0].params, [22]);
});

test('student creation uses the authenticated admin and ignores a submitted owner ID', async () => {
    const calls = [];
    const db = { async execute(sql, params) {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT id')) return [[]];
        return [{ insertId: 9 }];
    } };
    const { createStudent } = loadStudentController(db);
    const res = createResponse();

    await createStudent({
        user: { id: 22 },
        body: { userId: 99, studentId: 'STU-9', course: 'BCA', department: 'CS', graduationYear: 2026 }
    }, res);

    assert.match(calls[1].sql, /owner_admin_id/);
    assert.equal(calls[1].params[0], 22);
    assert.equal(res.statusCode, 201);
});

const certificate = {
    id: 7,
    certificate_id: 'CERT-001',
    title: 'BCA',
    certificate_type: 'Degree',
    issue_date: '2026-05-30',
    certificate_hash: 'matching-hash',
    status: 'VALID',
    blockchain_tx_hash: '0xtx'
};

const createDb = (certificateRows) => {
    const calls = [];
    return {
        calls,
        async execute(sql, params) {
            calls.push({ sql, params });
            if (sql.startsWith('SELECT id, certificate_id')) return [certificateRows];
            if (sql.startsWith('SELECT id, status') || sql.startsWith('SELECT c.id, c.status')) return [certificateRows];
            return [{}];
        }
    };
};

const createUploadedPdf = (contents = '%PDF-test-content') => {
    const filePath = path.join(os.tmpdir(), `certificate-verification-${Date.now()}-${Math.random()}.pdf`);
    fs.writeFileSync(filePath, contents);
    return {
        path: filePath,
        mimetype: 'application/pdf',
        originalname: 'certificate.pdf'
    };
};

const withBlockchainTestConfig = async (run) => {
    const keys = ['BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_PRIVATE_KEY', 'BLOCKCHAIN_CONTRACT_ADDRESS'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.BLOCKCHAIN_RPC_URL = 'http://127.0.0.1:8545';
    process.env.BLOCKCHAIN_PRIVATE_KEY = `0x${'1'.repeat(64)}`;
    process.env.BLOCKCHAIN_CONTRACT_ADDRESS = `0x${'2'.repeat(40)}`;

    try {
        await run();
    } finally {
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
};

const createFakeEthers = ({ code = '0x6000', networkError, issueError, receipt = { status: 1, hash: '0xreceipt' }, chainHash = 'expected-hash', readError } = {}) => {
    const calls = [];
    class JsonRpcProvider {
        async getNetwork() { calls.push('network'); if (networkError) throw networkError; return { chainId: 31337n }; }
        async getCode() { calls.push('code'); return code; }
        destroy() { calls.push('destroy'); }
    }
    class Wallet {
        constructor() { calls.push('wallet'); }
    }
    class Contract {
        async issueCertificate() {
            calls.push('issue');
            if (issueError) throw issueError;
            return {
                hash: '0xsubmitted',
                async wait() { calls.push('receipt'); return receipt; }
            };
        }
        async verifyCertificate() {
            calls.push('read');
            if (readError) throw readError;
            return [chainHash, '0xissuer', 1n, false];
        }
        async revokeCertificate() { throw new Error('not used by test'); }
    }
    return {
        calls,
        ethersApi: {
            JsonRpcProvider,
            Wallet,
            Contract,
            isAddress: (address) => /^0x[0-9a-f]{40}$/i.test(address)
        }
    };
};

const createIssuanceDb = () => {
    const calls = [];
    return {
        calls,
        async execute(sql, params) {
            calls.push({ sql, params });
            if (sql.startsWith('SELECT id FROM certificates')) return [[]];
            if (sql.startsWith('SELECT id FROM students')) return [[{ id: 15 }]];
            if (sql.startsWith('INSERT INTO certificates')) return [{ insertId: 23 }];
            return [{ affectedRows: 1 }];
        }
    };
};

const createIssueRequest = () => ({
    user: { id: 3, role: 'ADMIN' },
    body: {
        certificateId: 'CERT-NEW',
        studentId: 'STU-001',
        title: 'BCA',
        certificateType: 'Degree',
        issueDate: '2026-10-12'
    },
    file: createUploadedPdf()
});

test('rejects issuance before sending when the configured address has no bytecode', async () => {
    await withBlockchainTestConfig(async () => {
        const fake = createFakeEthers({ code: '0x' });
        const { issueCertificateOnChain } = createBlockchainService({ ethersApi: fake.ethersApi });

        await assert.rejects(
            issueCertificateOnChain('CERT-NEW', 'expected-hash'),
            (error) => error.code === 'CONTRACT_NOT_DEPLOYED'
        );
        assert.deepEqual(fake.calls, ['network', 'code', 'destroy']);
    });
});

test('does not confirm issuance when the contract call fails', async () => {
    await withBlockchainTestConfig(async () => {
        const fake = createFakeEthers({ issueError: new Error('transaction reverted') });
        const { issueCertificateOnChain } = createBlockchainService({ ethersApi: fake.ethersApi });

        await assert.rejects(
            issueCertificateOnChain('CERT-NEW', 'expected-hash'),
            (error) => error.code === 'BLOCKCHAIN_UNAVAILABLE'
        );
        assert.equal(fake.calls.includes('read'), false);
    });
});

test('confirms successful issuance by reading the matching certificate from chain', async () => {
    await withBlockchainTestConfig(async () => {
        const fake = createFakeEthers({ chainHash: 'expected-hash' });
        const service = createBlockchainService({ ethersApi: fake.ethersApi });

        const transactionHash = await service.issueCertificateOnChain('CERT-NEW', 'expected-hash');
        const verified = await service.verifyCertificateOnChain('CERT-NEW');

        assert.equal(transactionHash, '0xreceipt');
        assert.equal(verified.exists, true);
        assert.equal(verified.certificateHash, 'expected-hash');
        assert.ok(fake.calls.indexOf('receipt') < fake.calls.indexOf('read'));
    });
});

test('distinguishes a missing on-chain certificate from an unavailable RPC', async () => {
    await withBlockchainTestConfig(async () => {
        const missingFake = createFakeEthers({ readError: Object.assign(new Error('execution reverted'), { reason: 'Certificate does not exist' }) });
        const missingResult = await createBlockchainService({ ethersApi: missingFake.ethersApi }).verifyCertificateOnChain('MISSING');
        const unavailableFake = createFakeEthers({ networkError: new Error('connection refused') });
        const unavailableResult = await createBlockchainService({ ethersApi: unavailableFake.ethersApi }).verifyCertificateOnChain('CERT-NEW');

        assert.equal(missingResult.reason, 'NOT_FOUND');
        assert.equal(unavailableResult.reason, 'UNAVAILABLE');
    });
});

test('keeps a mined but unconfirmed issuance pending with its transaction hash', async () => {
    const db = createIssuanceDb();
    const file = createUploadedPdf();
    const { issueCertificate } = loadController(db, {
        issueCertificateOnChain: async () => {
            const error = new Error('read-back failed');
            error.transactionConfirmed = true;
            error.transactionHash = '0xconfirmed';
            throw error;
        }
    });
    const res = createResponse();

    try {
        await issueCertificate({ ...createIssueRequest(), file }, res);
        assert.equal(res.statusCode, 500);
        assert.equal(db.calls.find(({ sql }) => sql.startsWith('INSERT INTO certificates')).params[6], 'PENDING');
        assert.deepEqual(db.calls.find(({ sql }) => sql.startsWith('UPDATE certificates')).params, ['0xconfirmed', 23]);
        assert.equal(db.calls.some(({ sql }) => sql.startsWith('DELETE FROM certificates')), false);
        assert.equal(db.calls.some(({ sql }) => sql.includes('status = ?') && sql.includes('VALID')), false);
    } finally {
        fs.unlinkSync(file.path);
    }
});

test('rolls back the pending database row when blockchain issuance fails', async () => {
    const db = createIssuanceDb();
    const file = createUploadedPdf();
    const { issueCertificate } = loadController(db, {
        issueCertificateOnChain: async () => { throw Object.assign(new Error('issuance failed'), { code: 'CONTRACT_NOT_DEPLOYED' }); }
    });
    const res = createResponse();

    try {
        await issueCertificate({ ...createIssueRequest(), file }, res);
        assert.equal(res.statusCode, 500);
        assert.equal(db.calls.find(({ sql }) => sql.startsWith('INSERT INTO certificates')).params[6], 'PENDING');
        assert.equal(db.calls.some(({ sql }) => sql.startsWith('DELETE FROM certificates')), true);
        assert.equal(db.calls.some(({ sql }) => sql.includes('status = ?') && sql.includes('VALID')), false);
    } finally {
        fs.unlinkSync(file.path);
    }
});

test('marks a new database certificate VALID only after chain confirmation', async () => {
    const db = createIssuanceDb();
    const file = createUploadedPdf();
    const { issueCertificate } = loadController(db, {
        issueCertificateOnChain: async () => '0xconfirmed'
    });
    const res = createResponse();

    try {
        await issueCertificate({ ...createIssueRequest(), file }, res);
        assert.equal(res.statusCode, 201);
        assert.equal(db.calls.find(({ sql }) => sql.startsWith('INSERT INTO certificates')).params[6], 'PENDING');
        assert.deepEqual(
            db.calls.find(({ sql }) => sql.startsWith('UPDATE certificates')).params,
            ['0xconfirmed', 'VALID', 23]
        );
        assert.equal(res.body.certificate.status, 'VALID');
    } finally {
        fs.unlinkSync(file.path);
    }
});

test('returns VALID and logs an existing matching certificate', async () => {
    const db = createDb([certificate]);
    const { verifyCertificate } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: 'matching-hash', issuer: 'issuer', issuedAt: 1, revoked: false })
    });
    const res = createResponse();

    await verifyCertificate({ params: { certificateId: 'CERT-001' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.result, 'VALID');
    assert.equal(res.body.hashMatch, true);
    assert.equal(res.body.reason, null);
    assert.equal(db.calls.at(-1).params[1], 'VALID');
});

test('returns NOT_FOUND with a verification log for an unknown certificate', async () => {
    const db = createDb([]);
    const { verifyCertificate } = loadController(db, {});
    const res = createResponse();

    await verifyCertificate({ params: { certificateId: 'MISSING' } }, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.result, 'NOT_FOUND');
    assert.deepEqual(db.calls.at(-1).params, [null, 'NOT_FOUND']);
});

test('returns INVALID for a MySQL/on-chain hash mismatch', async () => {
    const db = createDb([certificate]);
    const { verifyCertificate } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: 'other-hash', issuer: 'issuer', issuedAt: 1, revoked: false })
    });
    const res = createResponse();

    await verifyCertificate({ params: { certificateId: 'CERT-001' } }, res);

    assert.equal(res.body.result, 'INVALID');
    assert.equal(res.body.reason, 'Certificate hash does not match the blockchain record');
});

test('returns REVOKED when MySQL marks a certificate revoked', async () => {
    const db = createDb([{ ...certificate, status: 'REVOKED' }]);
    const { verifyCertificate } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: 'matching-hash', issuer: 'issuer', issuedAt: 1, revoked: false })
    });
    const res = createResponse();

    await verifyCertificate({ params: { certificateId: 'CERT-001' } }, res);

    assert.equal(res.body.result, 'REVOKED');
});

test('returns INVALID with a clear reason when blockchain verification is unavailable', async () => {
    const db = createDb([certificate]);
    const { verifyCertificate } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: false, certificateHash: '', issuer: '', issuedAt: 0, revoked: false, reason: 'UNAVAILABLE' })
    });
    const res = createResponse();

    await verifyCertificate({ params: { certificateId: 'CERT-001' } }, res);

    assert.equal(res.body.result, 'INVALID');
    assert.equal(res.body.reason, 'Blockchain certificate could not be verified');
});

test('returns VALID for a PDF matching both MySQL and blockchain hashes', async () => {
    const file = createUploadedPdf();
    const { generateCertificateHash } = require('../services/hashService');
    const hash = generateCertificateHash(fs.readFileSync(file.path));
    const db = createDb([{ ...certificate, certificate_hash: hash }]);
    const { verifyCertificateWithPdf } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: hash, issuer: 'issuer', issuedAt: 1, revoked: false })
    });
    const res = createResponse();

    await verifyCertificateWithPdf({ params: { certificateId: 'CERT-001' }, file }, res);

    assert.equal(res.body.result, 'VALID');
    assert.equal(res.body.uploadedHashMatch, true);
    assert.equal(res.body.databaseHashMatch, true);
    assert.equal(fs.existsSync(file.path), false);
});

test('returns INVALID when the uploaded PDF hash differs from the blockchain hash', async () => {
    const file = createUploadedPdf();
    const db = createDb([certificate]);
    const { verifyCertificateWithPdf } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: 'different-hash', issuer: 'issuer', issuedAt: 1, revoked: false })
    });
    const res = createResponse();

    await verifyCertificateWithPdf({ params: { certificateId: 'CERT-001' }, file }, res);

    assert.equal(res.body.result, 'INVALID');
    assert.equal(res.body.uploadedHashMatch, false);
    assert.equal(fs.existsSync(file.path), false);
});

test('returns REVOKED when the blockchain record is revoked', async () => {
    const file = createUploadedPdf();
    const db = createDb([certificate]);
    const { verifyCertificateWithPdf } = loadController(db, {
        verifyCertificateOnChain: async () => ({ exists: true, certificateHash: certificate.certificate_hash, issuer: 'issuer', issuedAt: 1, revoked: true })
    });
    const res = createResponse();

    await verifyCertificateWithPdf({ params: { certificateId: 'CERT-001' }, file }, res);

    assert.equal(res.body.result, 'REVOKED');
    assert.equal(fs.existsSync(file.path), false);
});

test('cleans up the uploaded PDF when blockchain verification fails', async () => {
    const file = createUploadedPdf();
    const db = createDb([certificate]);
    const { verifyCertificateWithPdf } = loadController(db, {
        verifyCertificateOnChain: async () => { throw new Error('blockchain failure'); }
    });
    const res = createResponse();

    await verifyCertificateWithPdf({ params: { certificateId: 'CERT-001' }, file }, res);

    assert.equal(res.statusCode, 500);
    assert.equal(fs.existsSync(file.path), false);
});

test('revokes on-chain first and updates MySQL only after success', async () => {
    const db = createDb([{ id: 7, status: 'VALID' }]);
    const { revokeCertificate } = loadController(db, {
        revokeCertificateOnChain: async () => '0xrevoke'
    });
    const res = createResponse();

        await revokeCertificate({ params: { certificateId: 'CERT-001' }, user: { id: 3 } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.blockchainTxHash, '0xrevoke');
    assert.match(db.calls.at(-1).sql, /^UPDATE certificates SET status/);
});

test('does not call blockchain for an already revoked MySQL certificate', async () => {
    const db = createDb([{ id: 7, status: 'REVOKED' }]);
    let blockchainCalled = false;
    const { revokeCertificate } = loadController(db, {
        revokeCertificateOnChain: async () => { blockchainCalled = true; }
    });
    const res = createResponse();

    await revokeCertificate({ params: { certificateId: 'CERT-001' }, user: { id: 3 } }, res);

    assert.equal(res.statusCode, 400);
    assert.equal(blockchainCalled, false);
});

test('does not update MySQL when blockchain revocation fails', async () => {
    const db = createDb([{ id: 7, status: 'VALID' }]);
    const { revokeCertificate } = loadController(db, {
        revokeCertificateOnChain: async () => {
            const error = new Error('unavailable');
            error.code = 'BLOCKCHAIN_UNAVAILABLE';
            throw error;
        }
    });
    const res = createResponse();

    await revokeCertificate({ params: { certificateId: 'CERT-001' }, user: { id: 3 } }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(db.calls.some(({ sql }) => sql.startsWith('UPDATE certificates')), false);
});

test('rejects a non-admin authenticated user with 403', () => {
    const res = createResponse();
    let nextCalled = false;

    adminOnly({ user: { role: 'STUDENT' } }, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});
