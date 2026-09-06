const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');
const { normalizeUsername } = require('../../shared/account-identifiers');

async function findByUsername(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  if (env.demo.enabled) {
    return demoStore.users.find((u) => normalizeUsername(u.username) === normalized && u.status !== 'INACTIVE') || null;
  }

  const { rows } = await pool.query(
    `SELECT id,
            full_name AS "fullName",
            username,
            email,
            password_hash AS "passwordHash",
            role
       FROM users
      WHERE LOWER(username) = LOWER($1)
        AND status = 'ACTIVE'
      LIMIT 1`,
    [normalized],
  );
  return rows[0] || null;
}

async function findById(id) {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  if (env.demo.enabled) {
    return demoStore.users.find((u) => u.id === userId && u.status !== 'INACTIVE') || null;
  }

  const { rows } = await pool.query(
    `SELECT id,
            full_name AS "fullName",
            username,
            email,
            password_hash AS "passwordHash",
            role
       FROM users
      WHERE id = $1
        AND status = 'ACTIVE'
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function updatePassword(userId, passwordHash) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return false;

  if (env.demo.enabled) {
    const user = demoStore.users.find((item) => item.id === id && item.status !== 'INACTIVE');
    if (!user) return false;
    user.passwordHash = passwordHash;
    return true;
  }

  const result = await pool.query(
    `UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
      WHERE id = $2
        AND status = 'ACTIVE'`,
    [passwordHash, id],
  );
  return result.rowCount === 1;
}

module.exports = { findByUsername, findById, updatePassword };
