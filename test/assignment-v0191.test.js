const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('assignment create form does not reference undefined assignment variable', () => {
  const view = read('src/views/assignments/new.ejs');
  assert.equal(view.includes('assignment?.'), false);
  assert.match(view, /name="_csrf"/);
});

test('teacher assignment detail repository loads rubric and attachment metadata', () => {
  const repo = read('src/modules/assignments/assignment.repository.js');
  assert.match(repo, /AS "rubricScores"/);
  assert.match(repo, /AS "rubricFeedback"/);
  assert.match(repo, /assignment_submission_assets/);
  assert.match(repo, /AS assets/);
});

test('v0.19.1 database upgrade is intentionally no-op', () => {
  const sql = read('db/neon_upgrade_v0.19.1.sql');
  assert.match(sql, /No PostgreSQL \/ Neon schema changes are required/);
});
