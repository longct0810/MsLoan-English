const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function findByEmail(email) {
  if (env.demoMode) {
    return demoStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  const { rows } = await pool.query(
    `SELECT id,
            full_name AS "fullName",
            email,
            password_hash AS "passwordHash",
            role
       FROM users
      WHERE LOWER(email) = LOWER($1)
        AND status = 'ACTIVE'
      LIMIT 1`,
    [email],
  );
  return rows[0] || null;
}

module.exports = { findByEmail };
