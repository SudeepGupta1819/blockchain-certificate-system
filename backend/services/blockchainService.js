const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const artifactPath = path.join(
  __dirname,
  '../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json'
);

const getErrorText = (error) =>
  [error?.code, error?.reason, error?.shortMessage, error?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const getSafeBlockchainError = (operation, error) => {
  const errorText = getErrorText(error);
  const safeError = new Error(`Blockchain ${operation} failed`);

  if (errorText.includes('certificate is already revoked')) {
    safeError.code = 'CERTIFICATE_ALREADY_REVOKED';
  } else if (errorText.includes('certificate does not exist')) {
    safeError.code = 'CERTIFICATE_NOT_FOUND';
  } else {
    safeError.code = 'BLOCKCHAIN_UNAVAILABLE';
  }

  return safeError;
};

const createBlockchainService = ({ ethersApi = ethers, contractArtifactPath = artifactPath } = {}) => {
  const blockchainError = (code, message, details = {}) => Object.assign(new Error(message), { code, ...details });

  const getContractInstance = async ({ write = false } = {}) => {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.BLOCKCHAIN_CONTRACT_ADDRESS;

    if (!contractAddress || !ethersApi.isAddress(contractAddress)) {
      throw blockchainError('BLOCKCHAIN_CONFIGURATION', 'BLOCKCHAIN_CONTRACT_ADDRESS is missing or invalid.');
    }
    if (write && !privateKey) {
      throw blockchainError('BLOCKCHAIN_CONFIGURATION', 'BLOCKCHAIN_PRIVATE_KEY is not configured.');
    }
    if (!fs.existsSync(contractArtifactPath)) {
      throw blockchainError('BLOCKCHAIN_CONFIGURATION', 'CertificateRegistry artifact is missing. Compile the contract first.');
    }

    let artifact;
    try {
      artifact = JSON.parse(fs.readFileSync(contractArtifactPath, 'utf8'));
    } catch {
      throw blockchainError('BLOCKCHAIN_CONFIGURATION', 'CertificateRegistry artifact could not be loaded.');
    }

    let provider;
    try {
      provider = new ethersApi.JsonRpcProvider(rpcUrl);
      await provider.getNetwork();
    } catch {
      provider?.destroy?.();
      throw blockchainError('BLOCKCHAIN_UNAVAILABLE', 'Configured blockchain RPC endpoint is unavailable.');
    }

    let code;
    try {
      code = await provider.getCode(contractAddress);
    } catch {
      provider.destroy?.();
      throw blockchainError('BLOCKCHAIN_UNAVAILABLE', 'Unable to inspect the configured contract on the blockchain.');
    }
    if (!code || code === '0x') {
      provider.destroy?.();
      throw blockchainError('CONTRACT_NOT_DEPLOYED', 'No contract bytecode exists at BLOCKCHAIN_CONTRACT_ADDRESS.');
    }

    try {
      const runner = write ? new ethersApi.Wallet(privateKey, provider) : provider;
      return {
        contract: new ethersApi.Contract(contractAddress, artifact.abi, runner),
        provider,
      };
    } catch {
      provider.destroy?.();
      throw blockchainError('BLOCKCHAIN_CONFIGURATION', 'Blockchain signer or contract could not be initialized.');
    }
  };

  const issueCertificateOnChain = async (certificateId, certificateHash) => {
    let context;
    try {
      context = await getContractInstance({ write: true });
      const tx = await context.contract.issueCertificate(certificateId, certificateHash);
      let receipt;
      try {
        receipt = await tx.wait();
      } catch (error) {
        if (error.receipt && Number(error.receipt.status) === 0) {
          throw blockchainError('BLOCKCHAIN_ISSUANCE_FAILED', 'Blockchain certificate transaction reverted.');
        }
        throw blockchainError(
          'BLOCKCHAIN_CONFIRMATION_FAILED',
          'Blockchain transaction was submitted, but its receipt could not be confirmed.',
          { transactionSubmitted: true, transactionHash: tx.hash }
        );
      }
      if (!receipt || Number(receipt.status) !== 1) {
        throw blockchainError('BLOCKCHAIN_ISSUANCE_FAILED', 'Blockchain certificate transaction was not successful.');
      }

      const transactionHash = receipt.hash || tx.hash;
      try {
        const [confirmedHash, , , revoked] = await context.contract.verifyCertificate(certificateId);
        if (confirmedHash.toLowerCase() !== certificateHash.toLowerCase() || revoked) {
          throw new Error('On-chain certificate data does not match the issued certificate.');
        }
      } catch {
        throw blockchainError(
          'BLOCKCHAIN_CONFIRMATION_FAILED',
          'Blockchain transaction was mined, but the certificate could not be confirmed on the contract.',
          { transactionConfirmed: true, transactionHash }
        );
      }

      return transactionHash;
    } catch (error) {
      if (error.transactionConfirmed || error.transactionSubmitted || error.code === 'BLOCKCHAIN_CONFIGURATION'
        || error.code === 'BLOCKCHAIN_UNAVAILABLE' || error.code === 'CONTRACT_NOT_DEPLOYED'
        || error.code === 'BLOCKCHAIN_ISSUANCE_FAILED') {
        throw error;
      }
      console.error('Blockchain issueCertificate failed:', error.code || 'unknown error');
      throw getSafeBlockchainError('certificate issuance', error);
    } finally {
      context?.provider.destroy?.();
    }
  };

  const verifyCertificateOnChain = async (certificateId) => {
    let context;
    try {
      context = await getContractInstance();
      const [certificateHash, issuer, issuedAt, revoked] = await context.contract.verifyCertificate(certificateId);

      return {
        exists: true,
        certificateHash,
        issuer,
        issuedAt: Number(issuedAt),
        revoked,
      };
    } catch (error) {
      const errorText = getErrorText(error);
      const certificateMissing = errorText.includes('certificate does not exist');

      return {
        exists: false,
        certificateHash: '',
        issuer: '',
        issuedAt: 0,
        revoked: false,
        reason: certificateMissing ? 'NOT_FOUND' : 'UNAVAILABLE',
      };
    } finally {
      context?.provider.destroy?.();
    }
  };

  const revokeCertificateOnChain = async (certificateId) => {
    let context;
    try {
      context = await getContractInstance({ write: true });
      const tx = await context.contract.revokeCertificate(certificateId);
      const receipt = await tx.wait();
      if (!receipt || Number(receipt.status) !== 1) {
        throw blockchainError('BLOCKCHAIN_REVOCATION_FAILED', 'Blockchain revocation transaction was not successful.');
      }
      return receipt.hash || tx.hash;
    } catch (error) {
      console.error('Blockchain revokeCertificate failed:', error.code || 'unknown error');
      if (error.code === 'BLOCKCHAIN_CONFIGURATION' || error.code === 'BLOCKCHAIN_UNAVAILABLE'
        || error.code === 'CONTRACT_NOT_DEPLOYED' || error.code === 'BLOCKCHAIN_REVOCATION_FAILED') {
        throw error;
      }
      throw getSafeBlockchainError('certificate revocation', error);
    } finally {
      context?.provider.destroy?.();
    }
  };

  return { issueCertificateOnChain, verifyCertificateOnChain, revokeCertificateOnChain };
};

module.exports = { ...createBlockchainService(), createBlockchainService };
