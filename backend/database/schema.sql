-- Database initialization script

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS blockchain_certificate_db;
USE blockchain_certificate_db;

-- 1. users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. students table
CREATE TABLE IF NOT EXISTS students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    owner_admin_id INT NULL,
    user_id INT UNIQUE,
    student_id VARCHAR(50) NOT NULL UNIQUE,
    course VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    graduation_year INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_students_owner_admin FOREIGN KEY (owner_admin_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_students_owner_admin (owner_admin_id)
);

-- 3. certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    certificate_id VARCHAR(100) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    certificate_type VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,
    certificate_hash VARCHAR(64) NOT NULL,
    blockchain_tx_hash VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 4. verification_logs table
CREATE TABLE IF NOT EXISTS verification_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    certificate_id INT NULL,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(20) NOT NULL,
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
);

-- 5. email_otps table
CREATE TABLE IF NOT EXISTS email_otps (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(150) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_token (verification_token)
);

