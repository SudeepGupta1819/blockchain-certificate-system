// Safe, repeatable migration. Existing rows remain unassigned (NULL) because
// their original administrator cannot be inferred reliably from the old schema.
require('dotenv').config();
const db = require('../config/db');

async function migrate() {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'owner_admin_id'`
  );
  if (columns.length === 0) {
    await db.execute('ALTER TABLE students ADD COLUMN owner_admin_id INT NULL AFTER id');
    console.log('Added nullable students.owner_admin_id; legacy rows remain unassigned.');
  }

  const [indexes] = await db.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND INDEX_NAME = 'idx_students_owner_admin'`
  );
  if (indexes.length === 0) {
    await db.execute('CREATE INDEX idx_students_owner_admin ON students(owner_admin_id)');
  }

  const [constraints] = await db.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
       AND CONSTRAINT_NAME = 'fk_students_owner_admin' AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
  );
  if (constraints.length === 0) {
    await db.execute(
      'ALTER TABLE students ADD CONSTRAINT fk_students_owner_admin FOREIGN KEY (owner_admin_id) REFERENCES users(id) ON DELETE RESTRICT'
    );
  }
  console.log('Admin ownership migration complete. No existing data was reassigned or deleted.');
}

migrate()
  .catch((error) => {
    console.error('Admin ownership migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => db.end());
