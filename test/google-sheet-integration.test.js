const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.24.2 is the active application version', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.24.2');
  assert.equal(read('VERSION').trim(), '0.24.2');
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


test('v0.21.0 migration adds external assessment mapping tables and sync metrics', () => {
  const migration = read('db/neon_upgrade_v0.21.0.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS external_assessments/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS external_assessment_results/);
  assert.match(migration, /materialized_assessment_results/);
  assert.match(migration, /SET last_content_hash=NULL/);
  assert.match(read('db/schema.sql'), /v0\.21\.0 - Google Sheets Assessment Mapping/);
});

test('v0.21.0 exposes assessment mapping UI and teacher-scoped target validation', () => {
  const repository = read('src/modules/data-sources/google-sheet.repository.js');
  const controller = read('src/modules/data-sources/google-sheet.controller.js');
  const routes = read('src/modules/data-sources/google-sheet.routes.js');
  const view = read('src/views/teacher/data-sources/detail.ejs');
  assert.match(repository, /manualLinkAssessment/);
  assert.match(repository, /e\.class_id=\$2 AND c\.teacher_id=\$3/);
  assert.match(repository, /a\.class_id=\$2 AND c\.teacher_id=\$3/);
  assert.match(controller, /mapping_target/);
  assert.match(routes, /assessments\/:assessmentId\/link/);
  assert.match(view, /Bài kiểm tra \/ điểm nhận diện từ Google Sheets/);
  assert.match(view, /Bài ngoài hệ thống/);
});

test('v0.21.0 materializes assessment scores without creating fake exam attempts/submissions', () => {
  const repository = read('src/modules/data-sources/google-sheet.repository.js');
  assert.match(repository, /materializeAssessmentResult/);
  assert.match(repository, /INSERT INTO student_scores/);
  const materializer = repository.slice(repository.indexOf('async materializeAssessmentResult'), repository.indexOf('async listAssessmentsForSource'));
  assert.doesNotMatch(materializer, /INSERT INTO exam_attempts/);
  assert.doesNotMatch(materializer, /INSERT INTO assignment_submissions/);
});
