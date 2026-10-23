# Blockchain Based Certificate Verification System

## 1. Project Overview
This project is a small web application built for certificate verification using both a relational database and a blockchain record. The system allows an admin to create student records, upload PDF certificates, store their hash values in MySQL, and push the same certificate data to a local Hardhat blockchain. Users can then verify certificates by ID or by uploading the original PDF again.

The project uses blockchain to make a certificate record harder to tamper with and easier to verify independently. In this project, the blockchain is not a public network; it is a local development blockchain used for demonstration and learning.

MySQL is used as the main operational database for storing admin users, student details, certificate metadata, and verification logs. It is easier to query and manage structured data in a relational format than storing everything directly on-chain.

SHA-256 is a cryptographic hash function. It takes file contents and produces a fixed-length 64-character hexadecimal output. In this application, the uploaded PDF is hashed and compared later during verification. If even one byte in the file changes, the hash changes too.

This system solves a practical problem: a certificate can be forged or modified if only a simple PDF file is shared. By comparing the uploaded file against both the database and the blockchain, the application checks whether the document is original and still valid.

## 2. Project Goals
The intended MVP is:
- allow an admin to log in
- add students
- upload PDF certificates
- store certificate metadata in MySQL
- store the certificate hash on a local blockchain
- verify a certificate by ID
- verify a certificate by uploading the original PDF
- revoke a certificate when needed
- show a clear VALID / INVALID / REVOKED / NOT_FOUND result

This is a beginner-friendly DBMS and blockchain project and not a production-grade certificate authority system.

## 3. Tech Stack
The actual stack used in this project is:

### Frontend
- React 19.2.8
- Vite 8.2.2
- React Router DOM 7.18.3
- Tailwind CSS 4.3.3
- Plain JavaScript (not TypeScript)

### Backend
- Node.js
- Express 5.2.1
- MySQL 2 library (`mysql2`) 3.24.4
- `multer` 2.3.0 for PDF uploads
- `cors` 2.8.6
- `dotenv` 17.4.2
- `bcrypt` 6.0.0 for password hashing
- `jsonwebtoken` 9.0.3 for JWT auth
- `ethers` 6.17.0 for blockchain interaction

### Database
- MySQL
- Database name: `blockchain_certificate_db`

### Blockchain
- Hardhat 2.22.15
- Solidity ^0.8.28
- Local Ethereum-compatible development blockchain

### Smart contract
- `CertificateRegistry.sol`
- Contract name: `CertificateRegistry`

### Development tools
- Node.js project scripts via package.json
- npm
- Hardhat local node and deploy scripts
- Node.js built-in test runner

## 4. Complete Project Structure
Important project structure and what the folders contain:

```text
blockchain-certificate-system/
├── README.md
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── certificateController.js
│   │   └── studentController.js
│   ├── database/
│   │   └── schema.sql
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── certificateRoutes.js
│   │   └── studentRoutes.js
│   ├── services/
│   │   ├── blockchainService.js
│   │   └── hashService.js
│   ├── tests/
│   │   └── phase4.test.js
│   └── uploads/
│       └── uploaded PDF files are stored here
├── blockchain/
│   ├── package.json
│   ├── hardhat.config.js
│   ├── contracts/
│   │   └── CertificateRegistry.sol
│   ├── scripts/
│   │   └── deploy.js
│   ├── cache/
│   └── artifacts/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── api.js
│       ├── App.css
│       ├── App.jsx
│       ├── index.css
│       ├── main.jsx
│       └── VerifyPage.jsx
└── .gitignore
```

### backend/
The Node.js + Express server. This is the main application logic, API layer, DB access, and upload handling.

### backend/config/db.js
Creates the MySQL connection pool and loads environment variables from `.env`.

### backend/controllers/
Holds request handlers for authentication, student management, and certificate actions.

### backend/routes/
Defines the actual API routes.

### backend/services/
Contains business logic for blockchain interaction and SHA-256 hashing.

### backend/database/schema.sql
Creates the MySQL schema with the required tables and foreign keys.

### backend/tests/phase4.test.js
Contains the project’s current backend tests for verification and revocation logic.

### blockchain/
Contains Hardhat setup, the Solidity smart contract, and deployment script.

### blockchain/contracts/CertificateRegistry.sol
The smart contract storing certificate hash and revocation status.

### frontend/src/
Contains the React app screens and the client-side API wrapper.

## 5. Current Features
These are the features that are actually implemented in this project:

- Admin login using JWT
- Admin registration route exists in the backend API
- Student creation and list retrieval
- PDF upload during certificate issuance
- SHA-256 hashing of uploaded PDF bytes
- MySQL certificate storage
- Local blockchain certificate storage
- Certificate listing page in the admin UI
- Public certificate verification by ID
- Public verification by uploading a PDF
- VALID result when the uploaded PDF and stored hash match the blockchain record
- INVALID result when hash mismatch or blockchain record mismatch occurs
- REVOKED result when MySQL or blockchain marks the certificate as revoked
- NOT_FOUND result when the certificate does not exist in MySQL
- Verification log insertion into `verification_logs`
- Certificate revocation through API and admin UI
- Local blockchain transaction hash storage in MySQL as `blockchain_tx_hash`

## 6. Complete Application Flow

### Admin Login Flow
1. Admin enters email and password in the frontend login page.
2. Frontend calls `POST /api/auth/login`.
3. Backend checks the user email in the `users` table.
4. Password is compared using bcrypt.
5. On success, the backend creates a JWT using `JWT_SECRET`.
6. The frontend stores the token in browser session storage and redirects to the dashboard.

### Student Creation Flow
1. Admin enters student ID, course, department, and graduation year.
2. Frontend calls `POST /api/students` with a valid JWT.
3. Backend inserts a row into the `students` table.
4. The student is then available for certificate issuance.

### Certificate Issuing Flow
1. Admin enters certificate metadata: certificate ID, student ID, title, certificate type, issue date.
2. Admin uploads a PDF file.
3. Backend checks the file exists and is a PDF.
4. Backend reads the uploaded PDF file bytes.
5. The file is hashed using SHA-256.
6. The hash is stored in MySQL inside the `certificates` table.
7. Backend inserts the certificate row with `status = 'VALID'`.
8. Backend calls the blockchain contract function `issueCertificate(certificateId, certificateHash)`.
9. Backend receives the blockchain transaction hash.
10. Backend updates the MySQL row with `blockchain_tx_hash`.

This is the core flow:
PDF → SHA-256 → MySQL certificate row → blockchain issue call → transaction hash → certificate record updated

### Certificate Verification Flow
1. User enters a certificate ID and uploads a PDF.
2. Backend reads the PDF and generates a SHA-256 hash.
3. Backend looks up the certificate in MySQL by `certificate_id`.
4. Backend calls the blockchain contract `verifyCertificate(certificateId)`.
5. The backend compares:
   - uploaded PDF hash vs blockchain hash
   - database hash vs blockchain hash
   - MySQL status vs blockchain revoked flag
6. Result is returned as VALID, INVALID, REVOKED, or NOT_FOUND.

### Revocation Flow
1. Admin opens the certificate list and chooses revoke.
2. Backend checks the certificate exists in MySQL and is not already revoked.
3. Backend calls `revokeCertificate(certificateId)` on the blockchain.
4. If blockchain revocation succeeds, backend updates the MySQL `status` to `REVOKED`.
5. The result is returned with the transaction hash.

## 7. Database Design
The actual database is `blockchain_certificate_db`.

### Tables

#### users
Stores admin accounts.
- `id` — primary key, auto-increment
- `name` — admin name
- `email` — unique email
- `password_hash` — bcrypt password hash
- `role` — default `ADMIN`
- `created_at` — timestamp

#### students
Stores student records.
- `id` — primary key
- `user_id` — unique foreign key to `users.id`
- `student_id` — unique student ID
- `course` — course name
- `department` — department name
- `graduation_year` — year of graduation

#### certificates
Stores issued certificates.
- `id` — primary key
- `certificate_id` — unique certificate ID string
- `student_id` — foreign key to `students.id`
- `title` — certificate title
- `certificate_type` — e.g. degree, diploma, etc.
- `issue_date` — date of issue
- `certificate_hash` — SHA-256 hash of the certificate PDF
- `blockchain_tx_hash` — transaction hash from blockchain
- `status` — `VALID` or `REVOKED` (with default `VALID`)
- `created_at` — timestamp

#### verification_logs
Stores verification outcomes.
- `id` — primary key
- `certificate_id` — nullable foreign key to `certificates.id`
- `verified_at` — timestamp
- `result` — `VALID`, `INVALID`, `REVOKED`, or `NOT_FOUND`

### Relationships
- `users` → `students` via `students.user_id`
- `students` → `certificates` via `certificates.student_id`
- `certificates` → `verification_logs` via `verification_logs.certificate_id`

This structure makes sense because:
- admins are separate from students
- each certificate belongs to one student
- verification attempts are logged separately from the actual certificate record

## 8. API Documentation
The current backend routes are:

| Method | Endpoint | Authentication | Purpose |
|--------|----------|----------------|---------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register admin |
| POST | `/api/auth/login` | No | Login and receive JWT |
| GET | `/api/auth/me` | JWT required | Get current user data |
| GET | `/api/students` | JWT required | List students |
| POST | `/api/students` | JWT required | Create student |
| GET | `/api/certificates` | JWT required and admin-only | List issued certificates |
| POST | `/api/certificates` | JWT required and admin-only | Upload PDF and issue certificate |
| GET | `/api/verify/:certificateId` | No | Public verification by certificate ID |
| POST | `/api/verify/:certificateId` | No | Public verification with uploaded PDF |
| POST | `/api/certificates/:certificateId/revoke` | JWT required and admin-only | Revoke certificate |

### Important request/response notes
- `/api/auth/login` returns `token` and `user`
- `/api/students` accepts `studentId`, `course`, `department`, `graduationYear`
- `/api/certificates` accepts multipart form data including `file` and metadata fields
- `/api/verify/:certificateId` returns a result object with status and blockchain information
- `/api/certificates/:certificateId/revoke` returns success or error messages and the blockchain transaction hash

## 9. Blockchain
This project uses a local Hardhat blockchain, not a public network.

### Hardhat setup
Hardhat is configured in `blockchain/hardhat.config.js` and the project uses a local RPC endpoint.

### Solidity version
The contract uses:
- `pragma solidity ^0.8.28;`

### Contract name
- `CertificateRegistry`

### Contract purpose
The contract stores certificate metadata on-chain:
- `certificateId`
- `certificateHash`
- `issuer`
- `issuedAt`
- `revoked`
- `exists`

### Contract functions
- `issueCertificate(string memory certificateId, string memory certificateHash)`
- `verifyCertificate(string memory certificateId)`
- `revokeCertificate(string memory certificateId)`

### Events
- `CertificateIssued`
- `CertificateRevoked`

### What is stored on-chain
Only the certificate ID, certificate hash, issuer address, issue time, and revocation status are stored in the mapping.

### Backend communication
The backend reads `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, and `BLOCKCHAIN_CONTRACT_ADDRESS` from environment variables. These values are used to create an ethers provider and wallet, then to call the contract.

### Deployment
From the `blockchain` folder:
- `npm install`
- `npx hardhat node`
- `npm run deploy`

The default local RPC address is:
- `http://127.0.0.1:8545`

> Important: this is a local development blockchain only. It is not a public testnet or production chain.

## 10. SHA-256 Hashing
SHA-256 is a cryptographic hashing algorithm that converts data into a fixed-length 64-character hexadecimal string.

In this project:
- the hashing logic lives in `backend/services/hashService.js`
- the function is `generateCertificateHash(data)`
- it uses Node’s `crypto` module
- the hash is generated after reading the uploaded PDF file bytes
- the hash is stored in MySQL in the `certificates.certificate_hash` column
- the same hash is later compared against the blockchain value and the PDF hash generated during verification

When verification happens with a PDF upload, the server hashes the uploaded file again and compares it to the original stored blockchain hash. If a single byte is changed, the hash becomes different.

## 11. Verification Logic
The actual verification conditions in the current backend implementation are:

### VALID
The certificate is considered `VALID` when:
- the certificate exists in MySQL
- the blockchain record exists
- the uploaded PDF hash matches the blockchain hash
- the MySQL certificate hash matches the blockchain hash
- the certificate is not revoked

### INVALID
The certificate is considered `INVALID` when:
- the certificate exists in MySQL but the hash does not match the blockchain record
- the blockchain record does not exist for that certificate
- the uploaded file hash does not match the blockchain hash
- the blockchain cannot be checked successfully

### REVOKED
The certificate is considered `REVOKED` when:
- MySQL status is `REVOKED`
- or the blockchain record has `revoked === true`

### NOT_FOUND
The certificate is considered `NOT_FOUND` when:
- no row exists in the `certificates` table for that `certificate_id`
- the public verification endpoint responds with 404 and `result: 'NOT_FOUND'`

## 12. Testing
The current tests are in:
- `backend/tests/phase4.test.js`

This file tests:
- VALID verification cases
- NOT_FOUND validation
- INVALID mismatch logic
- REVOKED detection
- blockchain unavailable handling
- PDF verification behavior
- PDF cleanup after failed verification
- revocation flow
- admin authorization

### Latest known result
The backend test suite was run successfully with:
- 13 tests passed
- 0 failed

This result was confirmed by running:
- `cd backend && npm test`

### Frontend lint/build status
There was no confirmed lint/build result recorded in the project history at the time of this review, so no pass/fail claim should be made without running the commands.

## 13. Running the Project Locally
The application has a required startup order.

### 1. MySQL
Make sure MySQL is running locally and create the database schema:

```sql
CREATE DATABASE IF NOT EXISTS blockchain_certificate_db;
USE blockchain_certificate_db;
```

Then import the schema file:

```bash
mysql -u root -p < backend/database/schema.sql
```

### 2. Hardhat blockchain
From the blockchain folder:

```bash
cd blockchain
npm install
npx hardhat node
```

### 3. Contract deployment
In a second terminal:

```bash
cd blockchain
npm run deploy
```

This deploys the `CertificateRegistry` smart contract to the local Hardhat node.

### 4. Backend
From the backend folder:

```bash
cd backend
npm install
node server.js
```

The backend listens on:
- `http://localhost:5000`

### 5. Frontend
From the frontend folder:

```bash
cd frontend
npm install
npm run dev
```

The frontend is typically served on:
- `http://localhost:5173`

### Startup order reminder
Important order:
1. MySQL running
2. Hardhat node running
3. Contract deployed
4. Backend started
5. Frontend started

## 14. Environment Variables
The environment variables currently used by the project are:

```env
PORT=
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=

BLOCKCHAIN_RPC_URL=
BLOCKCHAIN_PRIVATE_KEY=
BLOCKCHAIN_CONTRACT_ADDRESS=
```

Do not put actual secret values into documentation. Only variable names are shown here.

## 15. Important Development Warnings
Important project notes for future developers and future AI assistants:

- The Hardhat blockchain is local and temporary.
- Restarting the Hardhat node resets the blockchain state.
- MySQL data does not reset automatically when the blockchain resets.
- If the contract is redeployed, the `BLOCKCHAIN_CONTRACT_ADDRESS` may change and must be updated in the backend `.env` file.
- The backend expects the blockchain artifact file on disk. If the contract has not been compiled or deployed, the backend may fail to connect.
- Uploaded PDFs are stored in `backend/uploads/` temporarily during processing.
- Verification and issuance both depend on the certificate ID being consistent between MySQL and blockchain.
- The frontend routes and API endpoints are configured for the backend port `5000` unless overridden by `VITE_API_URL`.
- JWT signing uses `JWT_SECRET` or a fallback default, but the real configuration should be stored in `.env`.

## 16. Current Project Status
The project is currently in a working MVP stage.

Completed:
- admin login flow
- student management
- PDF certificate issuing
- SHA-256 hashing
- MySQL certificate storage
- blockchain certificate storage
- verification by ID and by PDF upload
- revocation flow
- basic frontend pages
- backend tests for core logic

Planned next stages:
1. UI improvement
2. Code readability and humanization
3. Final testing
4. Project presentation preparation
5. DBMS/blockchain/viva preparation

These are the next stages mentioned by the project owner and were not added as new features.

## 17. Handoff Instructions for Future LLMs
Before making changes, read this README carefully and then check the actual code.

Important instructions:
- Read this README before changing anything.
- Inspect existing files before editing them.
- Do not assume a feature exists unless it is actually implemented in code.
- Preserve existing functionality unless explicitly asked to change behavior.
- Do not add features without approval.
- Do not modify the database schema, contract, authentication logic, API contract, or verification logic without explicit instruction.
- Prefer small, readable changes over large rewrites.
- Keep code understandable for a beginner college project.
- Explain changes in simple, practical language.
- Avoid unnecessary enterprise-level complexity.

## 18. Summary
This project is a learning-focused certificate verification system that combines:
- a MySQL database for structured records
- a local blockchain for tamper-resistant proof
- a Node/Express backend for API logic
- a React frontend for admin and public verification flows
- SHA-256 hashing to prove file integrity

It is a strong DBMS/blockchain college MVP and should be treated as a working educational project rather than a production certificate system.
