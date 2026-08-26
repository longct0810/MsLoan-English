const app = require('./app');
const env = require('./config/env');
const pool = require('./config/db');

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

  app.listen(env.app.port, env.app.host, () => {
    console.log(`${env.app.name} running at ${env.app.baseUrl}`);
    console.log(`Mode: ${env.demo.enabled ? 'DEMO DATA' : 'POSTGRESQL'}`);
    console.log(`Environment: ${env.app.nodeEnv}`);
  });
}

start();
