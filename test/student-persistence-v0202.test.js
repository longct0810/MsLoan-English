const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('student repository uses in-memory demo store when DEMO_MODE is enabled', () => {
  const repo = read('src/modules/students/student.repository.js');
  assert.match(repo, /async function create\(data, actorUserId, isAdmin = false\)/);
  assert.match(repo, /if \(env\.demo\.enabled\)/);
  assert.match(repo, /demoStore\.students\.push\(student\)/);
  assert.match(repo, /const client = await pool\.connect\(\)/);
});

test('v0.20.2 prevents DEMO_MODE in production', () => {
  const env = read('src/config/env.js');
  assert.match(env, /nodeEnv\.trim\(\)\.toLowerCase\(\) === 'production' && env\.demo\.enabled/);
  assert.match(env, /DEMO_MODE must be false when NODE_ENV=production/);
});

test('example environment defaults to persistent PostgreSQL mode', () => {
  const example = read('.env.example');
  assert.match(example, /^DEMO_MODE=false$/m);
  assert.match(example, /^SHOW_DEMO_ACCOUNTS_ON_LOGIN=false$/m);
});

test('UI and health endpoint expose active storage mode', () => {
  assert.match(read('src/views/partials/app-start.ejs'), /DEMO MODE đang bật/);
  assert.match(read('src/modules/health/health.routes.js'), /storageMode/);
  assert.match(read('src/modules/students/student.controller.js'), /chỉ lưu bộ nhớ, chưa ghi PostgreSQL\/Neon/);
});
