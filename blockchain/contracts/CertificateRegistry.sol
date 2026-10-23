// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CertificateRegistry {
    address public owner;

    struct Certificate {
        string certificateId;
        string certificateHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
        bool exists;
    }

    mapping(string => Certificate) private certificates;

    event CertificateIssued(
        string certificateId,
        string certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );

    event CertificateRevoked(
        string certificateId,
        address indexed revokedBy,
        uint256 revokedAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function issueCertificate(string memory certificateId, string memory certificateHash) external onlyOwner {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        require(bytes(certificateHash).length > 0, "Certificate hash cannot be empty");
        require(!certificates[certificateId].exists, "Certificate ID already exists");

        certificates[certificateId] = Certificate({
            certificateId: certificateId,
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revoked: false,
            exists: true
        });

        emit CertificateIssued(certificateId, certificateHash, msg.sender, block.timestamp);
    }

    function verifyCertificate(string memory certificateId)
        external
        view
        returns (
            string memory certificateHash,
            address issuer,
            uint256 issuedAt,
            bool revoked
        )
    {
        require(certificates[certificateId].exists, "Certificate does not exist");
        Certificate memory cert = certificates[certificateId];
        return (cert.certificateHash, cert.issuer, cert.issuedAt, cert.revoked);
    }

    function revokeCertificate(string memory certificateId) external onlyOwner {
        require(certificates[certificateId].exists, "Certificate does not exist");
        require(!certificates[certificateId].revoked, "Certificate is already revoked");

        certificates[certificateId].revoked = true;

        emit CertificateRevoked(certificateId, msg.sender, block.timestamp);
    }
}
