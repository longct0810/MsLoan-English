const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('v0.26.1 exposes lightweight cron keep-alive API', () => {
  const routes = read('src/modules/health/health.routes.js');
  assert.match(routes, /router\.get\('\/api\/cron\/ping'/);
  assert.match(routes, /service:\s*'cron-keepalive'/);
  assert.match(routes, /Cache-Control/);

  const start = routes.indexOf("router.get('/api/cron/ping'");
  const end = routes.indexOf("router.get('/health'");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.doesNotMatch(routes.slice(start, end), /pool\.query/);
});

test('health routes are mounted before PostgreSQL session middleware', () => {
  const app = read('src/app.js');
  const healthIndex = app.indexOf('app.use(healthRoutes);');
  const sessionIndex = app.indexOf('app.use(session(sessionOptions));');

  assert.notEqual(healthIndex, -1);
  assert.notEqual(sessionIndex, -1);
  assert.ok(healthIndex < sessionIndex);
});

test('package version is v0.26.1', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.26.1');
});
