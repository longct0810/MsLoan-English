const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildTransferCode } = require('../src/shared/account-identifiers');

test('v0.25.2 transfer content uses MMYYYY + student_code without spaces', () => {
  assert.equal(buildTransferCode('2026-09-01', 'Y6_HS9'), '092026Y6_HS9');
  assert.equal(buildTransferCode('2026-08', 'y9_hs43'), '082026Y9_HS43');
  assert.equal(buildTransferCode('', 'Y6_HS9'), '');
});

test('v0.25.2 migration rewrites only safe unpaid/draft invoices', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../db/neon_upgrade_v0.25.2.sql'), 'utf8');
  assert.match(sql, /TO_CHAR\(cy\.period_month, 'MMYYYY'\) \|\| s\.student_code/);
  assert.match(sql, /i\.status = 'DRAFT'/);
  assert.match(sql, /i\.status = 'UNPAID'/);
  assert.match(sql, /COALESCE\(i\.amount_paid, 0\) = 0/);
});
