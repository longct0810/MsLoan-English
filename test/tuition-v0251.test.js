const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('v0.25.1 tuition candidates come from attendance in billing period', () => {
  const repo = read('src/modules/tuition/tuition.repository.js');
  assert.match(repo, /SELECT DISTINCT[\s\S]*FROM class_sessions sess[\s\S]*JOIN session_attendance a ON a\.session_id=sess\.id[\s\S]*JOIN students s ON s\.id=a\.student_id/);
  assert.match(repo, /sess\.session_date BETWEEN \$2 AND \$3/);
  assert.doesNotMatch(repo, /cs\.joined_at <= \$3/);
});
