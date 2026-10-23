const nodemailer = require('nodemailer');

/**
 * Send OTP verification email using Nodemailer and SMTP.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.otp - 6-digit OTP code
 * @returns {Promise<Object>} Nodemailer send info
 */
const sendOtpEmail = async ({ to, otp }) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'no-reply@certichain.local';

  if (!user || !pass) {
    throw new Error(
      'SMTP credentials are missing. Please configure SMTP_USER and SMTP_PASS in backend/.env'
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: `"Certificate Verification System" <${from}>`,
    to,
    subject: `Your Verification Code: ${otp}`,
    text: `Your verification code is: ${otp}\n\nThis code will expire in 5 minutes. If you did not request this registration, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #000000; background-color: #ffffff;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: bold; color: #000000;">
          Certificate Verification System
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #000000;">
          Please use the following 6-digit verification code to complete your administrator account registration:
        </p>
        <div style="margin: 20px 0; padding: 16px; background-color: #f7f7f7; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #000000; border: 1px solid #000000;">
          ${otp}
        </div>
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #000000;">
          This code is valid for 5 minutes. If you did not initiate this request, no further action is required.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('SMTP Email Delivery Error:', error.message);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = {
  sendOtpEmail,
};
