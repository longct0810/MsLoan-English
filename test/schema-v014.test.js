const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('v0.14 migration expands score precision and adds ownership indexes', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'neon_upgrade_v0.14.0.sql'), 'utf8');
  assert.match(sql, /assignment_submissions[\s\S]*NUMERIC\(8,2\)/i);
  assert.match(sql, /student_scores[\s\S]*max_score[\s\S]*NUMERIC\(8,2\)/i);
  assert.match(sql, /idx_classes_teacher_active/i);
  assert.match(sql, /idx_questions_created_by/i);
});
