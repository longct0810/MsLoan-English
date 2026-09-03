const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildVietQrImageUrl } = require('../src/modules/tuition/tuition.qr');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('v0.23 migration seeds confirmed tuition rates and billing tables', () => {
  const sql = read('db/neon_upgrade_v0.23.0.sql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tuition_plans/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tuition_cycles/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tuition_invoices/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS tuition_payments/);
  assert.match(sql, /WHEN g\.grade_no = 6 THEN 150000 ELSE 220000/);
  assert.match(sql, /\["PRESENT","LATE","ONLINE"\]/);
});

test('v0.23 materializes tuition from session_attendance snapshots', () => {
  const repo = read('src/modules/tuition/tuition.repository.js');
  assert.match(repo, /JOIN session_attendance a ON a\.session_id=cs\.id/);
  assert.match(repo, /calculation_snapshot/);
  assert.match(repo, /source_type AS "sourceType"/);
  assert.match(repo, /status=CASE WHEN final_amount=0 THEN 'PAID' ELSE 'UNPAID' END/);
});

test('v0.23 teacher and parent routes are ownership scoped', () => {
  const routes = read('src/modules/tuition/tuition.routes.js');
  const repo = read('src/modules/tuition/tuition.repository.js');
  assert.match(routes, /\/teacher\/tuition/);
  assert.match(routes, /requireRole\('TEACHER'\)/);
  assert.match(routes, /\/parent\/tuition/);
  assert.match(repo, /ps\.parent_user_id=\$1/);
  assert.match(repo, /i\.teacher_id=\$2/);
});

test('v0.23 VietQR URL includes exact amount and transfer content', () => {
  const url = buildVietQrImageUrl({
    bankBin: '970422', accountNo: '123456789', accountName: 'NGUYEN VAN A',
    amount: 1200000, transferContent: 'HP-202608-000009',
  });
  assert.match(url, /^https:\/\/img\.vietqr\.io\/image\/970422-123456789-compact2\.png\?/);
  assert.match(url, /amount=1200000/);
  assert.match(url, /addInfo=HP-202608-000009/);
  assert.match(url, /accountName=NGUYEN\+VAN\+A/);
});

test('v0.23 menu and parent notifications expose tuition', () => {
  const menu = read('src/views/partials/app-start.ejs');
  const portal = read('src/modules/portal/portal.service.js');
  assert.match(menu, /Học phí & QR/);
  assert.match(menu, /href="\/parent\/tuition"/);
  assert.match(portal, /title: 'Thông báo học phí'/);
  assert.match(portal, /\/parent\/tuition\/\$\{item\.id\}/);
});
