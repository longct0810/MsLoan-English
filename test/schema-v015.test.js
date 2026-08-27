const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }

test('v0.15.0 migration and graders class-scope student_scores', () => {
  const migration = read('db/neon_upgrade_v0.15.0.sql');
  const schema = read('db/schema.sql');
  const assignmentRepo = read('src/modules/assignments/assignment.repository.js');
  const examRepo = read('src/modules/exams/exam.repository.js');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS class_id BIGINT REFERENCES classes\(id\)/i);
  assert.match(migration, /ss\.assignment_id = a\.id/i);
  assert.match(migration, /ss\.exam_id = e\.id/i);
  assert.match(migration, /idx_student_scores_class_recorded/i);
  assert.match(schema, /v0\.15\.0 - Teacher Report Center/i);
  assert.match(assignmentRepo, /student_id, assignment_id, class_id/i);
  assert.match(examRepo, /student_id,exam_id,class_id/i);
});
