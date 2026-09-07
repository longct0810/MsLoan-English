'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseTeacherTrackingSheet,
  normalizeSheetProfile,
} = require('../src/modules/data-sources/google-sheet-csv');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.25.0 supports per-source CUSTOM header profile', () => {
  const csv = [
    ',,07.09.2026,',
    'Mã,STT,Họ và Tên,CC',
    'x,1,Vũ Văn Đăng Khánh,1',
    'x,2,Vũ Văn Đăng Khoa,0',
  ].join('\n');

  const profile = normalizeSheetProfile({
    mode: 'CUSTOM',
    header_row_index: 1,
    date_row_index: 0,
    field_row_index: 1,
    data_start_index: 2,
    stt_column_index: 1,
    student_name_column_index: 2,
    attendance_aliases: ['CC'],
    confirmed: true,
  });

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5, profile });
  assert.equal(parsed.students.length, 2);
  assert.equal(parsed.students[0].externalStudentName, 'Vũ Văn Đăng Khánh');
  const attendance = parsed.students[0].observations.find((x) => x.sourceColumnIndex === 3);
  assert.equal(attendance.observationType, 'ATTENDANCE');
  assert.equal(attendance.normalizedStatus, 'PRESENT');
  assert.equal(attendance.observedOn, '2026-09-07');
});

test('v0.25.0 column override can repair an otherwise unknown attendance header and date', () => {
  const csv = [
    'STT,Họ và Tên,Dữ liệu A',
    '1,Vũ Văn Đăng Khánh,1',
    '2,Vũ Văn Đăng Khoa,0',
  ].join('\n');

  const profile = {
    mode: 'SINGLE_ROW',
    confirmed: true,
    column_overrides: {
      2: { type: 'ATTENDANCE', field_name: 'Điểm danh', observed_on: '2026-09-07' },
    },
  };
  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5, profile });
  const obs = parsed.students[0].observations[0];
  assert.equal(obs.observationType, 'ATTENDANCE');
  assert.equal(obs.normalizedStatus, 'PRESENT');
  assert.equal(obs.observedOn, '2026-09-07');
});

test('v0.25.0 source UI exposes schema profile and dry-run flow', () => {
  const routes = read('src/modules/data-sources/google-sheet.routes.js');
  const controller = read('src/modules/data-sources/google-sheet.controller.js');
  const service = read('src/modules/data-sources/google-sheet.service.js');
  const repo = read('src/modules/data-sources/google-sheet.repository.js');
  const detail = read('src/views/teacher/data-sources/detail.ejs');
  const schema = read('src/views/teacher/data-sources/schema.ejs');
  assert.match(routes, /\/:id\/schema/);
  assert.match(controller, /schemaProfile/);
  assert.match(controller, /updateSchemaProfile/);
  assert.match(service, /inspectSource/);
  assert.match(service, /materializationAllowedByProfile/);
  assert.match(repo, /updateSheetProfile/);
  assert.match(detail, /Cấu hình & Dry-run/);
  assert.match(schema, /Schema Profile/);
  assert.match(schema, /Override type/);
});

test('v0.25.0 migration enables confirmation guard without adding physical columns', () => {
  const migration = read('db/neon_upgrade_v0.25.0.sql');
  assert.match(migration, /sheet_profile/);
  assert.match(migration, /require_confirmed_sheet_profile/);
  assert.match(migration, /last_content_hash = NULL/);
});
