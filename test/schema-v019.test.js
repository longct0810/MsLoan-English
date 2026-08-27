const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'db', 'neon_upgrade_v0.19.0.sql'), 'utf8');
const repo = fs.readFileSync(path.join(root, 'src', 'modules', 'exams', 'exam.repository.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src', 'modules', 'exams', 'exam.service.js'), 'utf8');

test('v0.19 migration contains Exam 2.0 tables and snapshot columns', () => {
  for (const token of ['exam_pool_rules', 'exam_question_snapshots', 'exam_attempt_questions', 'exam_student_overrides', 'selected_option_key', 'effective_duration_minutes']) {
    assert.match(migration, new RegExp(token));
  }
  assert.match(migration, /UPDATE exam_answers[\s\S]*selected_option_key/);
});

test('v0.19 publish materializes immutable question snapshots', () => {
  assert.match(repo, /INSERT INTO exam_question_snapshots/);
  assert.match(repo, /snapshotted|question_snapshots|exam_question_snapshots/);
});

test('v0.19 supports pool generation, randomization and per-student override', () => {
  assert.match(service, /POOL_NOT_ENOUGH_QUESTIONS/);
  assert.match(service, /randomizeQuestions/);
  assert.match(service, /saveOverride/);
  assert.match(repo, /exam_student_overrides/);
});
