const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.20.1 is the active application version', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.20.1');
  assert.equal(read('VERSION').trim(), '0.20.1');
});

test('Google Sheets module is mounted with teacher-only authorization', () => {
  const app = read('src/app.js');
  assert.match(app, /createGoogleSheetModule/);
  assert.match(app, /requireTeacher:\s*requireRole\('TEACHER'\)/);
  assert.match(app, /app\.use\('\/teacher\/data-sources',\s*googleSheetModule\.router\)/);
});

test('Google Sheets scheduler starts from the production server', () => {
  const server = read('src/server.js');
  assert.match(server, /startGoogleSheetSyncJob/);
  assert.match(server, /app\.googleSheetModule\.service/);
  assert.match(server, /!env\.demo\.enabled/);
});

test('Google Sheets views live under the configured src views directory and use app layout', () => {
  for (const file of ['index.ejs', 'detail.ejs']) {
    const viewPath = `src/views/teacher/data-sources/${file}`;
    assert.ok(fs.existsSync(path.join(root, viewPath)), `${viewPath} must exist`);
    const view = read(viewPath);
    assert.match(view, /partials\/app-start/);
    assert.match(view, /partials\/app-end/);
  }
});

test('v0.20.0 migration is available in db and cumulative schema', () => {
  assert.ok(fs.existsSync(path.join(root, 'db/neon_upgrade_v0.20.0.sql')));
  const migration = read('db/neon_upgrade_v0.20.0.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS external_data_sources/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS external_observations/);
  assert.match(migration, /source_type IN \('LEGACY','ASSIGNMENT','EXAM','MANUAL','EXTERNAL'\)/);
  assert.match(read('db/schema.sql'), /v0\.20\.0 - Google Sheets Data Source/);
});


test('v0.20.1 mapping UI lists all teacher students and can activate source-class membership', () => {
  const repository = read('src/modules/data-sources/google-sheet.repository.js');
  const controller = read('src/modules/data-sources/google-sheet.controller.js');
  const view = read('src/views/teacher/data-sources/detail.ejs');
  assert.match(repository, /getTeacherStudentsForMapping/);
  assert.match(repository, /INSERT INTO class_students\(class_id,student_id,status,joined_at,left_at\)/);
  assert.match(repository, /UPDATE external_observations/);
  assert.match(repository, /SET last_content_hash=NULL/);
  assert.match(controller, /getTeacherStudentsForMapping\(user\.id, source\.class_id\)/);
  assert.match(view, /Học sinh khác của giáo viên/);
  assert.match(view, /in_source_class/);
});

test('v0.20.1 renders import_from_date as a Vietnamese date instead of Date.toString prefix', () => {
  const view = read('src/views/teacher/data-sources/detail.ejs');
  assert.match(view, /toLocaleDateString\('vi-VN'/);
  assert.doesNotMatch(view, /String\(source\.import_from_date\)\.slice/);
});
