'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseTeacherTrackingSheet } = require('../src/modules/data-sources/google-sheet-csv');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.24.3 does not consume first student row as field header on single-row Google Sheet header', () => {
  const csv = [
    'STT,Họ và Tên,07.09.2026 Điểm danh,Reading /20',
    '1,Vũ Văn Đăng Khánh,1,17',
    '2,Vũ Văn Đăng Khoa,1,19',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5 });

  assert.equal(parsed.students.length, 2);
  assert.deepEqual(
    parsed.students.map((student) => student.externalStudentName),
    ['Vũ Văn Đăng Khánh', 'Vũ Văn Đăng Khoa'],
  );
  assert.equal(parsed.students[0].externalStudentKey, 'name:vu van dang khanh');
  assert.equal(parsed.students[1].externalStudentKey, 'name:vu van dang khoa');

  const attendanceColumn = parsed.columns.find((column) => column.index === 2);
  assert.equal(attendanceColumn.fieldName, 'Điểm danh');
  assert.equal(attendanceColumn.observedOn, '2026-09-07');
});

test('v0.24.3 still supports two-row date + field headers', () => {
  const csv = [
    'STT,Họ và Tên,07.09.2026,',
    ',,Điểm danh,Reading /20',
    '1,Vũ Văn Đăng Khánh,1,17',
    '2,Vũ Văn Đăng Khoa,1,19',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5 });
  assert.equal(parsed.students.length, 2);
  assert.equal(parsed.students[0].externalStudentName, 'Vũ Văn Đăng Khánh');
  assert.equal(parsed.students[1].externalStudentName, 'Vũ Văn Đăng Khoa');
});

test('v0.25.0 is the active application version', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '0.25.0');
  assert.equal(read('VERSION').trim(), '0.25.0');
});
