'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCsv,
  normalizeName,
  classifyObservation,
  parseTeacherTrackingSheet,
} = require('../src/modules/data-sources/google-sheet-csv');
const { parseGoogleSheetUrl, isDateAllowed } = require('../src/modules/data-sources/google-sheet.service');

test('CSV parser handles quoted comma/newline', () => {
  const rows = parseCsv('a,"b,c","x\ny"\n1,2,3\n');
  assert.deepEqual(rows, [['a', 'b,c', 'x\ny'], ['1', '2', '3']]);
});

test('Vietnamese student names normalize consistently', () => {
  assert.equal(normalizeName('Nguyễn  Duy Bảo'), 'nguyen duy bao');
  assert.equal(normalizeName('NGUYEN DUY BAO'), 'nguyen duy bao');
});

test('observation classifier detects score, attendance, CEFR and note', () => {
  assert.deepEqual(classifyObservation('PET TEST 2 Reading /32', '26'), {
    type: 'SCORE', normalizedStatus: null, skillCode: 'READING', numericValue: 26, maxValue: 32,
  });
  assert.equal(classifyObservation('Điểm danh', '1').normalizedStatus, 'PRESENT');
  assert.equal(classifyObservation('Theo thang đo Cambridge', 'B1').type, 'LEVEL');
  assert.equal(classifyObservation('Lưu ý về các thì quá khứ', 'Chú ý mệnh đề when').type, 'NOTE');
});

test('teacher tracking sheet parser supports actual two-row layout: STT/name on date row, details below', () => {
  const csv = [
    'STT,Họ và Tên,13.8.2026,,,,',
    ',,PET TEST 2 Reading /32,Điểm danh,Theo thang đo Cambridge,Lưu ý về các thì quá khứ',
    '1,Nguyễn Duy Bảo,26,1,B1,"Chú ý mệnh đề when"',
  ].join('\n');
  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 9 });
  assert.equal(parsed.students.length, 1);
  assert.equal(parsed.students[0].observations.length, 4);
  assert.ok(parsed.students[0].observations.every((x) => x.observedOn === '2026-08-13'));
  assert.equal(parsed.students[0].observations[0].fieldName, 'PET TEST 2 Reading /32');
});

test('teacher tracking parser also supports date row above STT/name row', () => {
  const csv = [
    ',,13.8.2026,',
    'STT,Họ và Tên,PET TEST 2 Reading /32,Điểm danh',
    '1,Nguyễn Duy Bảo,26,1',
  ].join('\n');
  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 9 });
  assert.equal(parsed.students.length, 1);
  assert.equal(parsed.students[0].observations[0].observedOn, '2026-08-13');
});

test('Google Sheet URL parser accepts gid in hash', () => {
  const parsed = parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/abcDEF123/edit?gid=0#gid=0');
  assert.equal(parsed.spreadsheetId, 'abcDEF123');
  assert.equal(parsed.sheetGid, '0');
});

test('future dates are staged but blocked from core materialization', () => {
  const result = isDateAllowed({ settings: { skip_future_dates: true } }, '2099-01-01');
  assert.equal(result.allowed, false);
  assert.match(result.warning, /tương lai/);
});

test('columns after the last explicit date are flagged as unbounded for staging-only safety', () => {
  const csv = [
    'STT,Họ và Tên,13.8.2026,,',
    ',,Điểm danh,Lưu ý,Tháng 8',
    '1,Nguyễn Duy Bảo,1,Ổn,8.0',
  ].join('\n');
  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 9 });
  const obs = parsed.students[0].observations;
  assert.equal(obs[0].dateConfidence, 'EXPLICIT');
  assert.equal(obs[1].dateConfidence, 'UNBOUNDED_LAST_GROUP');
});
