'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseTeacherTrackingSheet } = require('../src/modules/data-sources/google-sheet-csv');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('v0.24.2 keeps a named student row even when STT and learning cells are empty', () => {
  const csv = [
    'STT,Họ và Tên,07.09.2026',
    ',,Điểm danh',
    '2,Vũ Văn Đăng Khoa,1',
    ',Vũ Văn Đăng Khánh,',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5 });
  assert.equal(parsed.students.length, 2);
  assert.equal(parsed.students[0].externalStudentName, 'Vũ Văn Đăng Khoa');
  assert.equal(parsed.students[1].externalStudentName, 'Vũ Văn Đăng Khánh');
  assert.equal(parsed.students[1].externalStudentKey, 'name:vu van dang khanh');
  assert.equal(parsed.students[1].observations.length, 0);
  assert.equal(parsed.students[1].missingName, false);
});

test('v0.24.2 exposes a data row with blank student name instead of silently dropping it', () => {
  const csv = [
    'STT,Họ và Tên,07.09.2026,',
    ',,Điểm danh,Reading /20',
    '2,Vũ Văn Đăng Khoa,1,16',
    ',,1,14',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 5 });
  assert.equal(parsed.students.length, 2);
  const unnamed = parsed.students[1];
  assert.equal(unnamed.externalStudentKey, 'row:4');
  assert.equal(unnamed.externalStudentName, 'Dòng 4 (chưa có Họ và Tên)');
  assert.equal(unnamed.missingName, true);
  assert.ok(unnamed.observations.length > 0);
});

test('v0.24.2 service refuses auto-match for missing-name rows but preserves manual mapping', () => {
  const service = read('src/modules/data-sources/google-sheet.service.js');
  assert.match(service, /extStudent\.missingName/);
  assert.match(service, /method:\s*'MISSING_NAME'/);
  assert.match(service, /existingLink\?\.match_method === 'MANUAL'/);
});

test('v0.24.2 row-retention regression remains covered after later upgrades', () => {
  const parser = read('src/modules/data-sources/google-sheet-csv.js');
  const service = read('src/modules/data-sources/google-sheet.service.js');
  assert.match(parser, /missingName/);
  assert.match(service, /MISSING_NAME/);
});
