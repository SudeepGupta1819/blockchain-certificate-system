const assert = require('node:assert/strict');
const test = require('node:test');

const dbPath = require.resolve('../config/db');
const emailServicePath = require.resolve('../services/emailService');
const authControllerPath = require.resolve('../controllers/authController');

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

const loadAuthController = (db, sendOtpEmail) => {
    const originalDb = require.cache[dbPath];
    const originalEmailService = require.cache[emailServicePath];

    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    require.cache[emailServicePath] = {
        id: emailServicePath,
        filename: emailServicePath,
        loaded: true,
        exports: { sendOtpEmail }
    };
    delete require.cache[authControllerPath];
    const controller = require('../controllers/authController');

    if (originalDb) require.cache[dbPath] = originalDb;
    else delete require.cache[dbPath];
    if (originalEmailService) require.cache[emailServicePath] = originalEmailService;
    else delete require.cache[emailServicePath];

    return controller;
};

const createDb = (handler) => ({
    calls: [],
    async execute(sql, params = []) {
        this.calls.push({ sql, params });
        return handler(sql, params);
    }
});

test('sends a secure OTP through a mocked SMTP service without returning it', async () => {
    let delivered;
    const db = createDb((sql) => {
        if (sql.startsWith('SELECT id FROM users')) return [[]];
        if (sql.startsWith('SELECT created_at')) return [[]];
        if (sql.startsWith('SELECT COUNT(*)')) return [[{ count: 0 }]];
        return [{}];
    });
    const { sendOtp } = loadAuthController(db, async (message) => {
        delivered = message;
        return { messageId: 'mock-message-id' };
    });
    const res = createResponse();

    await sendOtp({ body: { email: '  TEST@example.com  ' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(Object.hasOwn(res.body, 'otp'), false);
    assert.equal(delivered.to, 'test@example.com');
    assert.match(delivered.otp, /^\d{6}$/);

    const insert = db.calls.find(({ sql }) => sql.startsWith('INSERT INTO email_otps'));
    assert.ok(insert);
    assert.equal(insert.params[0], 'test@example.com');
    assert.match(insert.params[1], /^[a-f0-9]{64}$/);
    assert.notEqual(insert.params[1], delivered.otp);
    assert.ok(insert.params[2] instanceof Date);
    assert.ok(Math.abs(insert.params[2].getTime() - (Date.now() + 5 * 60 * 1000)) < 1000);
});

test('enforces the resend cooldown without sending another email', async () => {
    let emailSent = false;
    const db = createDb((sql) => {
        if (sql.startsWith('SELECT id FROM users')) return [[]];
        if (sql.startsWith('SELECT created_at')) return [[{ created_at: new Date() }]];
        return [[]];
    });
    const { sendOtp } = loadAuthController(db, async () => {
        emailSent = true;
    });
    const res = createResponse();

    await sendOtp({ body: { email: 'test@example.com' } }, res);

    assert.equal(res.statusCode, 429);
    assert.match(res.body.message, /wait 60 seconds/);
    assert.equal(emailSent, false);
    assert.equal(db.calls.some(({ sql }) => sql.startsWith('INSERT INTO email_otps')), false);
});

test('limits incorrect OTP attempts to five', async () => {
    const challenge = {
        id: 42,
        otp_hash: 'not-the-hash',
        expires_at: new Date(Date.now() + 60_000),
        attempts: 0
    };
    const db = createDb((sql, params) => {
        if (sql.startsWith('SELECT id, otp_hash')) return [[{ ...challenge }]];
        if (sql.startsWith('UPDATE email_otps SET attempts')) {
            challenge.attempts = params[0];
        }
        return [{}];
    });
    const { verifyOtp } = loadAuthController(db, async () => {});

    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const res = createResponse();
        await verifyOtp({ body: { email: 'test@example.com', otp: '000000' } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(challenge.attempts, attempt);
    }

    const finalResponse = createResponse();
    await verifyOtp({ body: { email: 'test@example.com', otp: '000000' } }, finalResponse);
    assert.equal(finalResponse.statusCode, 400);
    assert.match(finalResponse.body.message, /Maximum attempts exceeded/);
    assert.ok(db.calls.some(({ sql }) => sql.startsWith('DELETE FROM email_otps')));
});

test('registration cannot create an account without a verified email token', async () => {
    const db = createDb((sql) => {
        if (sql.startsWith('SELECT id FROM users')) return [[]];
        return [[]];
    });
    const { register } = loadAuthController(db, async () => {});
    const res = createResponse();

    await register({
        body: {
            name: 'Test Admin',
            email: 'test@example.com',
            password: 'College2026'
        }
    }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /has not been verified/);
    assert.equal(db.calls.some(({ sql }) => sql.startsWith('INSERT INTO users')), false);
});

test('registration consumes the verified email token after one use', async () => {
    let tokenAvailable = true;
    const db = createDb((sql) => {
        if (sql.startsWith('SELECT id FROM users')) return [[]];
        if (sql.includes('verification_token = ?')) {
            return [tokenAvailable ? [{ id: 12 }] : []];
        }
        if (sql.startsWith('DELETE FROM email_otps')) tokenAvailable = false;
        if (sql.startsWith('INSERT INTO users')) return [{ insertId: 7 }];
        return [[]];
    });
    const { register } = loadAuthController(db, async () => {});
    const request = {
        body: {
            name: 'Test Admin',
            email: 'test@example.com',
            password: 'College2026',
            verificationToken: 'one-time-token'
        }
    };
    const firstResponse = createResponse();
    await register(request, firstResponse);
    const secondResponse = createResponse();
    await register(request, secondResponse);

    assert.equal(firstResponse.statusCode, 201);
    assert.equal(secondResponse.statusCode, 400);
    assert.equal(db.calls.filter(({ sql }) => sql.startsWith('INSERT INTO users')).length, 1);
});

test('registration rejects passwords that miss any required strength rule', async () => {
    const invalidPasswords = ['college2026', 'COLLEGE2026', 'CollegePassword', 'Ab1c'];
    for (const password of invalidPasswords) {
        const db = createDb(() => [{}]);
        const { register } = loadAuthController(db, async () => {});
        const res = createResponse();

        await register({ body: { name: 'Test Admin', email: 'test@example.com', password } }, res);

        assert.equal(res.statusCode, 400, `expected ${password} to be rejected`);
        assert.match(res.body.message, /at least 8 characters/);
        assert.equal(db.calls.some(({ sql }) => /FROM users|INSERT INTO users/.test(sql)), false);
    }
});

test('registration accepts College2026 without requiring special characters', async () => {
    let tokenAvailable = true;
    const db = createDb((sql) => {
        if (sql.startsWith('SELECT id FROM users')) return [[]];
        if (sql.includes('verification_token = ?')) return [tokenAvailable ? [{ id: 12 }] : []];
        if (sql.startsWith('DELETE FROM email_otps')) tokenAvailable = false;
        if (sql.startsWith('INSERT INTO users')) return [{ insertId: 7 }];
        return [[]];
    });
    const { register } = loadAuthController(db, async () => {});
    const res = createResponse();

    await register({ body: {
        name: 'Test Admin', email: 'test@example.com', password: 'College2026', verificationToken: 'one-time-token'
    } }, res);

    assert.equal(res.statusCode, 201);
    assert.ok(db.calls.some(({ sql }) => sql.startsWith('INSERT INTO users')));
});

test('existing users with simple passwords can still log in', async () => {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('simple', 4);
    const db = createDb((sql) => sql.startsWith('SELECT * FROM users')
        ? [[{ id: 8, name: 'Existing Admin', email: 'existing@example.com', role: 'ADMIN', password_hash: passwordHash }]]
        : [[]]);
    const { login } = loadAuthController(db, async () => {});
    const res = createResponse();

    await login({ body: { email: 'existing@example.com', password: 'simple' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
});

test('email service sends only through a mocked Nodemailer transport', async () => {
    const nodemailer = require('nodemailer');
    const { sendOtpEmail } = require('../services/emailService');
    const originalCreateTransport = nodemailer.createTransport;
    const originalEnv = Object.fromEntries(
        ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
            .map((key) => [key, process.env[key]])
    );
    let sentMessage;
    let transportConfig;

    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'sender@example.test';
    process.env.SMTP_PASS = 'mock-secret';
    process.env.SMTP_FROM = 'sender@example.test';
    nodemailer.createTransport = (config) => {
        transportConfig = config;
        return {
            async sendMail(message) {
                sentMessage = message;
                return { messageId: 'mock-message-id' };
            }
        };
    };

    try {
        const result = await sendOtpEmail({ to: 'recipient@example.test', otp: '123456' });
        assert.equal(result.messageId, 'mock-message-id');
        assert.equal(transportConfig.auth.user, 'sender@example.test');
        assert.equal(sentMessage.to, 'recipient@example.test');
        assert.match(sentMessage.text, /123456/);
    } finally {
        nodemailer.createTransport = originalCreateTransport;
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});
