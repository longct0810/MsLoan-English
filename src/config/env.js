require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bool(name) {
  const value = required(name).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  throw new Error(`Environment variable ${name} must be a boolean.`);
}

function number(name) {
  const value = Number(required(name));
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return value;
}

function trustProxy(name) {
  const value = required(name).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0) return numeric;
  return required(name);
}

const env = {
  app: {
    name: required('APP_NAME'),
    shortName: required('APP_SHORT_NAME'),
    host: required('APP_HOST'),
    port: number('PORT'),
    baseUrl: required('APP_BASE_URL'),
    nodeEnv: required('NODE_ENV'),
    timezone: required('APP_TIMEZONE'),
    apiPrefix: required('API_PREFIX'),
    trustProxy: trustProxy('TRUST_PROXY'),
    jsonLimit: required('BODY_JSON_LIMIT'),
    urlencodedLimit: required('BODY_URLENCODED_LIMIT'),
  },
  assets: {
    bootstrapCssUrl: required('BOOTSTRAP_CSS_URL'),
    bootstrapJsUrl: required('BOOTSTRAP_JS_URL'),
  },
  session: {
    secret: required('SESSION_SECRET'),
    cookieName: required('SESSION_COOKIE_NAME'),
    maxAgeMs: number('SESSION_MAX_AGE_MS'),
    httpOnly: bool('SESSION_HTTP_ONLY'),
    sameSite: required('SESSION_SAME_SITE'),
    secure: bool('SESSION_SECURE'),
    resave: bool('SESSION_RESAVE'),
    saveUninitialized: bool('SESSION_SAVE_UNINITIALIZED'),
    tableName: required('SESSION_TABLE_NAME'),
    createTableIfMissing: bool('SESSION_CREATE_TABLE_IF_MISSING'),
  },
  demo: {
    enabled: bool('DEMO_MODE'),
    showAccountsOnLogin: bool('SHOW_DEMO_ACCOUNTS_ON_LOGIN'),
    teacher: {
      fullName: required('DEMO_TEACHER_NAME'),
      email: required('DEMO_TEACHER_EMAIL'),
      password: required('DEMO_TEACHER_PASSWORD'),
    },
    student: {
      fullName: required('DEMO_STUDENT_NAME'),
      email: required('DEMO_STUDENT_EMAIL'),
      password: required('DEMO_STUDENT_PASSWORD'),
    },
    parent: {
      fullName: required('DEMO_PARENT_NAME'),
      email: required('DEMO_PARENT_EMAIL'),
      password: required('DEMO_PARENT_PASSWORD'),
    },
  },
  security: {
    bcryptRounds: number('BCRYPT_ROUNDS'),
  },
  academic: {
    defaultSchoolYear: required('DEFAULT_SCHOOL_YEAR'),
  },
  db: {
    host: required('DB_HOST'),
    port: number('DB_PORT'),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    ssl: bool('DB_SSL'),
    sslRejectUnauthorized: bool('DB_SSL_REJECT_UNAUTHORIZED'),
    poolMax: number('DB_POOL_MAX'),
    idleTimeoutMs: number('DB_POOL_IDLE_TIMEOUT_MS'),
    connectionTimeoutMs: number('DB_POOL_CONNECTION_TIMEOUT_MS'),
  },
};

process.env.TZ = env.app.timezone;

module.exports = env;
