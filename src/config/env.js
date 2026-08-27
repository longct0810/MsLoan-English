require('dotenv').config();
const packageJson = require('../../package.json');

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

function optional(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
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
    version: optional('APP_VERSION', packageJson.version),
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
  exam: {
    defaultDurationMinutes: Number(optional('EXAM_DEFAULT_DURATION_MINUTES', '30')),
    maxDurationMinutes: Number(optional('EXAM_MAX_DURATION_MINUTES', '360')),
    defaultMaxAttempts: Number(optional('EXAM_DEFAULT_MAX_ATTEMPTS', '1')),
    maxAttempts: Number(optional('EXAM_MAX_ATTEMPTS', '10')),
    defaultShowResult: optional('EXAM_DEFAULT_SHOW_RESULT', 'true').trim().toLowerCase() === 'true',
    autosaveDebounceMs: Number(optional('EXAM_AUTOSAVE_DEBOUNCE_MS', '500')),
  },
  assignment: {
    uploadMaxFileMb: Number(optional('ASSIGNMENT_UPLOAD_MAX_FILE_MB', '10')),
    uploadMaxFiles: Number(optional('ASSIGNMENT_UPLOAD_MAX_FILES', '3')),
  },
  question: {
    defaultPoints: Number(optional('QUESTION_DEFAULT_POINTS', '1')),
    maxPoints: Number(optional('QUESTION_MAX_POINTS', '100')),
    importMaxRows: Number(optional('QUESTION_IMPORT_MAX_ROWS', '2000')),
    importMaxFileMb: Number(optional('QUESTION_IMPORT_MAX_FILE_MB', '5')),
  },
  db: {
    connectionString: optional('DATABASE_URL', null),
    host: optional('DB_HOST', '127.0.0.1'),
    port: Number(optional('DB_PORT', '5432')),
    database: optional('DB_NAME', 'english_classroom'),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', 'postgres'),
    ssl: optional('DB_SSL', 'false').trim().toLowerCase() === 'true',
    sslRejectUnauthorized: optional('DB_SSL_REJECT_UNAUTHORIZED', 'false').trim().toLowerCase() === 'true',
    channelBinding: optional('DB_CHANNEL_BINDING', 'false').trim().toLowerCase() === 'true',
    startupCheck: optional('DB_STARTUP_CHECK', 'true').trim().toLowerCase() === 'true',
    poolMax: Number(optional('DB_POOL_MAX', '10')),
    idleTimeoutMs: Number(optional('DB_POOL_IDLE_TIMEOUT_MS', '30000')),
    connectionTimeoutMs: Number(optional('DB_POOL_CONNECTION_TIMEOUT_MS', '5000')),
  },
};

if (!env.db.connectionString) {
  for (const [name, value] of [
    ['DB_HOST', env.db.host],
    ['DB_PORT', env.db.port],
    ['DB_NAME', env.db.database],
    ['DB_USER', env.db.user],
    ['DB_PASSWORD', env.db.password],
  ]) {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing database environment variable: ${name}`);
    }
  }
}

process.env.TZ = env.app.timezone;

module.exports = env;
