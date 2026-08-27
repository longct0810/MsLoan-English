process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const reportService = require('../src/modules/reports/report.service');

test('builds teacher report KPIs within owned classes', async () => {
  const report = await reportService.getReport(1, false, { month: '2026-08' });
  assert.equal(report.month, '2026-08');
  assert.equal(report.classStats.length, 4);
  assert.equal(report.metrics.studentCount, 8);
  assert.ok(report.metrics.averageScore > 0);
  assert.ok(report.attention.some((item) => item.studentId === 5));
  assert.ok(report.attention.every((item) => ['HIGH', 'MEDIUM'].includes(item.priority)));
});

test('rejects a class filter outside teacher ownership', async () => {
  await assert.rejects(
    () => reportService.getReport(999, false, { month: '2026-08', classId: 1 }),
    /CLASS_NOT_FOUND/,
  );
});

test('filters report to one owned class', async () => {
  const report = await reportService.getReport(1, false, { month: '2026-08', classId: 2 });
  assert.equal(report.selectedClassId, 2);
  assert.equal(report.classStats.length, 1);
  assert.equal(report.classStats[0].id, 2);
  assert.equal(report.metrics.studentCount, 2);
});

test('student report enforces class ownership and membership', async () => {
  const detail = await reportService.getStudentReport(1, false, 3, { month: '2026-08', classId: 2 });
  assert.equal(detail.student.id, 3);
  assert.equal(detail.classInfo.id, 2);
  assert.ok(detail.scores.length > 0);

  const denied = await reportService.getStudentReport(999, false, 3, { month: '2026-08', classId: 2 });
  assert.equal(denied, null);
});
