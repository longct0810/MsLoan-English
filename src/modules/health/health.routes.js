const express = require('express');
const pool = require('../../config/db');
const env = require('../../config/env');

const router = express.Router();

// v0.26.1: Lightweight public endpoint for external cron/uptime callers.
// Intentionally avoids database/session access so keep-alive requests stay cheap.
router.get('/api/cron/ping', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'cron-keepalive',
    app: env.app.name,
    version: env.app.version,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: env.app.name,
    version: env.app.version,
    environment: env.app.nodeEnv,
    storageMode: env.demo.enabled ? 'memory-demo' : 'postgresql',
    demoMode: env.demo.enabled,
  });
});

router.get('/health/db', async (req, res) => {
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: env.db.connectionString ? 'neon/postgresql' : 'postgresql',
      version: env.app.version,
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
