const { Pool } = require('pg');
const env = require('./env');

const commonOptions = {
  max: env.db.poolMax,
  idleTimeoutMillis: env.db.idleTimeoutMs,
  connectionTimeoutMillis: env.db.connectionTimeoutMs,
};

let poolConfig;

if (env.db.connectionString) {
  // Neon/hosted PostgreSQL: SSL is controlled by sslmode in DATABASE_URL.
  // Do not add an ssl object when sslmode is present because node-postgres
  // lets connection-string SSL options override the explicit ssl object.
  poolConfig = {
    ...commonOptions,
    connectionString: env.db.connectionString,
    enableChannelBinding: env.db.channelBinding,
  };

  if (!/[?&]sslmode=/i.test(env.db.connectionString) && env.db.ssl) {
    poolConfig.ssl = { rejectUnauthorized: env.db.sslRejectUnauthorized };
  }
} else {
  // Local/self-hosted PostgreSQL fallback.
  poolConfig = {
    ...commonOptions,
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
    ssl: env.db.ssl ? { rejectUnauthorized: env.db.sslRejectUnauthorized } : false,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('[DB] Unexpected PostgreSQL pool error:', error.message);
});

module.exports = pool;
