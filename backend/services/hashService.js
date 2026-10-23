const crypto = require('crypto');

/**
 * Generate a SHA-256 hash for a certificate file or any input bytes.
 * @param {string|Buffer} data
 * @returns {string}
 */
const generateCertificateHash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = {
  generateCertificateHash,
};
