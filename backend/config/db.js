const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'blockchain_certificate_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool
  .getConnection()
  .then((connection) => {
    console.log('Successfully connected to the database.');
    connection.release();
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error.message);
    console.error('Please ensure MySQL is running and the database/credentials are correctly configured in .env');
  });

module.exports = pool;
