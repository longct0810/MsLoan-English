const app = require('./app');
const env = require('./config/env');
const pool = require('./config/db');
const { startGoogleSheetSyncJob } = require('./jobs/google-sheet-sync.job');

let httpServer = null;
let stopGoogleSheetJob = () => {};
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[APP] ${signal} received, shutting down...`);
  stopGoogleSheetJob();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }

  try {
    await pool.end();
  } catch (error) {
    console.error('[DB] Pool shutdown failed:', error.message);
  }
}

async function start() {
  if (!env.demo.enabled && env.db.startupCheck) {
    try {
      await pool.query('SELECT 1');
      console.log(`[DB] Connected: ${env.db.connectionString ? 'Neon / hosted PostgreSQL' : 'PostgreSQL'}`);
    } catch (error) {
      console.error('[DB] Startup connection failed:', error.message);
      process.exit(1);
    }
  }

  httpServer = app.listen(env.app.port, env.app.host, () => {
    console.log(`${env.app.name} running at ${env.app.baseUrl}`);
    console.log(`Mode: ${env.demo.enabled ? 'DEMO DATA' : 'POSTGRESQL'}`);
    console.log(`Environment: ${env.app.nodeEnv}`);

    if (!env.demo.enabled) {
      stopGoogleSheetJob = startGoogleSheetSyncJob(app.googleSheetModule.service, { logger: console });
    } else {
      console.log('[GOOGLE_SHEET_SYNC] Scheduler disabled in DEMO_MODE.');
    }
  });
}

process.once('SIGTERM', () => {
  shutdown('SIGTERM').finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  shutdown('SIGINT').finally(() => process.exit(0));
});

start();
