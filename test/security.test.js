const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureCsrfToken, requireSameOrigin, requireCsrfToken } = require('../src/middleware/security.middleware');

function response() {
  return { locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, render(view, data) { this.view = view; this.body = data; return this; } };
}

test('creates and exposes a session CSRF token', () => {
  const req = { session: {} };
  const res = { locals: {} };
  let called = false;
  ensureCsrfToken(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.match(req.session.csrfToken, /^[a-f0-9]{64}$/);
  assert.equal(res.locals.csrfToken, req.session.csrfToken);
});

test('blocks cross-origin state-changing requests', () => {
  const req = { method: 'POST', protocol: 'http', path: '/classes', get(name) { return name === 'origin' ? 'https://attacker.example' : undefined; } };
  const res = response();
  requireSameOrigin(req, res, () => assert.fail('request should be blocked'));
  assert.equal(res.statusCode, 403);
});

test('accepts a matching CSRF token', () => {
  const req = { method: 'POST', path: '/classes', session: { csrfToken: 'token' }, body: { _csrf: 'token' }, get() { return undefined; } };
  const res = response();
  let called = false;
  requireCsrfToken(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('rejects an invalid API CSRF token', () => {
  const req = { method: 'POST', path: '/api/v1/classes', session: { csrfToken: 'expected' }, body: { _csrf: 'wrong' }, get() { return undefined; } };
  const res = response();
  requireCsrfToken(req, res, () => assert.fail('request should be blocked'));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'CSRF token invalid');
});
test('accepts parsed multipart form only with a matching CSRF token', () => {
  const { requireParsedCsrfToken } = require('../src/middleware/security.middleware');
  const req = {
    method: 'POST',
    path: '/questions/import',
    session: { csrfToken: 'upload-token' },
    body: { _csrf: 'upload-token' },
    get() { return undefined; },
  };
  const res = response();
  let called = false;
  requireParsedCsrfToken(req, res, () => { called = true; });
  assert.equal(called, true);
});

test('rejects parsed multipart form with a missing CSRF token', () => {
  const { requireParsedCsrfToken } = require('../src/middleware/security.middleware');
  const req = {
    method: 'POST',
    path: '/questions/import',
    session: { csrfToken: 'upload-token' },
    body: {},
    get() { return undefined; },
  };
  const res = response();
  requireParsedCsrfToken(req, res, () => assert.fail('request should be blocked'));
  assert.equal(res.statusCode, 403);
});
