const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('v0.25.3 does not reuse status bind parameter in paid_at CASE', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/tuition/tuition.repository.js'), 'utf8');
  assert.doesNotMatch(source, /paid_at\s*=\s*CASE\s+WHEN\s+\$2\s*=\s*'PAID'/i);
  assert.match(source, /const paidAt = status === 'PAID' \? new Date\(\) : null;/);
  assert.match(source, /status=\$2[\s\S]*paid_at=\$3[\s\S]*WHERE id=\$4/);
  assert.match(source, /\[paid, status, paidAt, invoiceId\]/);
});
