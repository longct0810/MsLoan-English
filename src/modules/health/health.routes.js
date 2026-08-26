const express = require('express');
const pool = require('../../config/db');
const env = require('../../config/env');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: env.app.name,
    environment: env.app.nodeEnv,
  });
});

router.get('/health/db', async (req, res) => {
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: env.db.connectionString ? 'neon/postgresql' : 'postgresql',
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('[DB HEALTH]', error.message);
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});

module.exports = router;
