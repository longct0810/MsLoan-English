process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const portalService = require('../src/modules/portal/portal.service');

test('builds an authorized monthly parent report', async () => {
  const result = await portalService.getParentReport(3, 3, '2026-08');
  assert.equal(result.selected.id, 3);
  assert.equal(result.report.month, '2026-08');
  assert.ok(result.report.metrics.totalAttendance > 0);
  assert.ok(result.report.metrics.totalAssignments > 0);
  assert.ok(result.report.skills.length > 0);
});

test('falls back to an authorized child when requested child is invalid', async () => {
  const result = await portalService.getParentReport(3, 999, '2026-08');
  assert.equal(result.selected.id, 3);
  assert.equal(result.report.student.id, 3);
});
