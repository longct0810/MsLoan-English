'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.24.0 is active', () => {
  assert.equal(JSON.parse(read('package.json')).version, '0.24.2');
  assert.equal(read('VERSION').trim(), '0.24.2');
});

test('manual Google Sheets sync forces re-processing', () => {
  const controller = read('src/modules/data-sources/google-sheet.controller.js');
  const view = read('src/views/teacher/data-sources/detail.ejs');
  assert.match(controller, /force:\s*req\.body\.force\s*!==\s*'0'/);
  assert.match(view, /name="force" value="1"/);
});

test('Google Sheets sync refreshes progress summaries after score or attendance materialization', () => {
  const service = read('src/modules/data-sources/google-sheet.service.js');
  const repository = read('src/modules/data-sources/google-sheet.repository.js');
  assert.match(service, /touchedStudentIds/);
  assert.match(service, /refreshStudentProgress/);
  assert.match(repository, /async refreshStudentProgress/);
  assert.match(repository, /AVG\(\(ss\.score \/ NULLIF\(ss\.max_score,0\)\) \* 10\)/);
  assert.match(repository, /session_attendance/);
  assert.match(repository, /attendance_records/);
});

test('assessment detail shows whether score really reached student_scores', () => {
  const repository = read('src/modules/data-sources/google-sheet.repository.js');
  const view = read('src/views/teacher/data-sources/assessment-detail.ejs');
  assert.match(repository, /materialized_score_id/);
  assert.match(repository, /LEFT JOIN student_scores ss/);
  assert.match(view, /Đã ghi điểm/);
  assert.match(view, /Chưa ghi student_scores/);
});
