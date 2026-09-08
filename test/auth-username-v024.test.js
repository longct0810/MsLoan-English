const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildStudentCode, buildTransferCode, validateUsername } = require('../src/shared/account-identifiers');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('v0.24 authenticates by username instead of email', () => {
  const controller = read('src/modules/auth/auth.controller.js');
  const repo = read('src/modules/auth/auth.repository.js');
  const loginView = read('src/views/auth/login.ejs');
  assert.match(controller, /req\.body\.username/);
  assert.doesNotMatch(controller, /req\.body\.email/);
  assert.match(repo, /LOWER\(username\) = LOWER\(\$1\)/);
  assert.doesNotMatch(loginView, /type="email"/);
  assert.match(loginView, /name="username"/);
});

test('v0.24 student form uses account names, not required email login fields', () => {
  const service = read('src/modules/students/student.service.js');
  const form = read('src/views/students/form.ejs');
  assert.match(service, /studentUsername/);
  assert.match(service, /parentUsername/);
  assert.doesNotMatch(service, /Email đăng nhập học viên không hợp lệ/);
  assert.match(form, /name="studentUsername"/);
  assert.match(form, /name="parentUsername"/);
  assert.doesNotMatch(form, /name="studentEmail"/);
  assert.doesNotMatch(form, /name="parentEmail"/);
});

test('v0.24 student and tuition identifiers follow required format', () => {
  assert.equal(buildStudentCode(6, 9), 'Y6_HS9');
  assert.equal(buildStudentCode(9, 123), 'Y9_HS123');
  assert.equal(buildTransferCode('2026-09-01', 'Y6_HS9'), '092026Y6_HS9');
  assert.equal(buildTransferCode('2026-09', 'Y9_HS123'), '092026Y9_HS123');
});

test('username validation is not email validation', () => {
  assert.equal(validateUsername('caogialinh'), null);
  assert.equal(validateUsername('0976365728'), null);
  assert.match(validateUsername('cao@gmail.com'), /chỉ được gồm/);
});

test('v0.24 migration backfills username, student_code and tuition transfer_code', () => {
  const sql = read('db/neon_upgrade_v0.24.0.sql');
  assert.match(sql, /ALTER TABLE users ADD COLUMN IF NOT EXISTS username/);
  assert.match(sql, /uq_users_username_ci/);
  assert.match(sql, /ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code/);
  assert.match(sql, /Y' \|\| pg\.grade_no::text \|\| '_HS'/);
  assert.match(sql, /ALTER TABLE tuition_invoices ADD COLUMN IF NOT EXISTS transfer_code/);
  assert.match(sql, /'HP ' \|\| TO_CHAR\(cy\.period_month, 'YYYYMM'\) \|\| ' ' \|\| s\.student_code/);
});
