const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('parent_students remains many-to-many so one parent can own multiple children', () => {
  const schema = read('db/schema.sql');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS parent_students/);
  assert.match(schema, /PRIMARY KEY \(parent_user_id, student_id\)/);
});

test('student create reuses an existing PARENT username instead of creating a duplicate account', () => {
  const repo = read('src/modules/students/student.repository.js');
  assert.match(repo, /SELECT id, role FROM users WHERE LOWER\(username\)=LOWER\(\$1\) LIMIT 1/);
  assert.match(repo, /if \(parentUserResult\.rows\[0\]\)/);
  assert.match(repo, /parentUserId = parentUserResult\.rows\[0\]\.id/);
});

test('editing one sibling never renames a shared parent account implicitly', () => {
  const repo = read('src/modules/students/student.repository.js');
  assert.match(repo, /countOtherActiveChildrenForParent/);
  assert.match(repo, /ps\.student_id<>\$2/);
  assert.match(repo, /Tài khoản hiện tại đang dùng chung cho anh\/chị\/em khác/);
  assert.match(repo, /tạo tài khoản phụ huynh riêng cho học viên này/);
});

test('shared parent profile is synchronized to legacy student parent fields', () => {
  const repo = read('src/modules/students/student.repository.js');
  assert.match(repo, /syncLegacyParentProfile/);
  assert.match(repo, /SET parent_name=u\.full_name/);
  assert.match(repo, /parent_phone=COALESCE\(u\.phone, s\.parent_phone\)/);
});

test('parent portal and tuition support multiple linked children', () => {
  const portalRepo = read('src/modules/portal/portal.repository.js');
  const tuitionRepo = read('src/modules/tuition/tuition.repository.js');
  assert.match(portalRepo, /WHERE p\.parent_user_id = \$1 AND s\.status = 'ACTIVE'/);
  assert.doesNotMatch(portalRepo.match(/async function getChildrenByParentUserId[\s\S]*?return rows;/)?.[0] || '', /LIMIT 1/);
  assert.match(tuitionRepo, /WHERE ps\.parent_user_id=\$1 AND s\.deleted_at IS NULL AND s\.status='ACTIVE'/);
});

test('student UI marks a shared parent account and warns before shared-account edits', () => {
  const indexView = read('src/views/students/index.ejs');
  const formView = read('src/views/students/form.ejs');
  assert.match(indexView, /Tài khoản chung/);
  assert.match(formView, /Tài khoản phụ huynh dùng chung/);
  assert.match(formView, /tách riêng học viên này/);
});
