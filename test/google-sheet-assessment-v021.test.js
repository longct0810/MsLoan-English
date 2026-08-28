'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseTeacherTrackingSheet,
  inferAssessmentResult,
} = require('../src/modules/data-sources/google-sheet-csv');

test('v0.21 groups adjacent Sheet columns into logical assessments', () => {
  const csv = [
    'STT,Họ và Tên,15.8.2026,,,,,,,13.8.2026,',
    ',,UNIT 3 Test 1 Test 2,,Reading - Level B1 /21,,,Tenses Các thì động từ /20,,PET TEST 2 Reading /32,Điểm danh',
    '1,Cao Gia Linh,8.75,35,Test 3,4.8,10,5.5,11,17,1',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 77 });
  assert.equal(parsed.assessments.length, 4);
  assert.deepEqual(
    parsed.assessments.map((a) => [a.title, a.sourceColumnStart, a.sourceColumnEnd]),
    [
      ['UNIT 3 Test 1 Test 2', 2, 3],
      ['Reading - Level B1 /21', 4, 6],
      ['Tenses Các thì động từ /20', 7, 8],
      ['PET TEST 2 Reading /32', 9, 9],
    ],
  );
});

test('v0.21 resolves normalized/raw score pairs and preserves both scales', () => {
  const csv = [
    'STT,Họ và Tên,15.8.2026,,,,,,,13.8.2026,',
    ',,UNIT 3 Test 1 Test 2,,Reading - Level B1 /21,,,Tenses Các thì động từ /20,,PET TEST 2 Reading /32,Điểm danh',
    '1,Cao Gia Linh,8.75,35,Test 3,4.8,10,5.5,11,17,1',
  ].join('\n');

  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 77 });
  const results = Object.fromEntries(parsed.students[0].assessmentResults.map((r) => [r.title, r]));

  assert.equal(results['UNIT 3 Test 1 Test 2'].rawScore, 35);
  assert.equal(results['UNIT 3 Test 1 Test 2'].rawMaxScore, 40);
  assert.equal(results['UNIT 3 Test 1 Test 2'].normalizedScore, 8.75);

  assert.equal(results['Reading - Level B1 /21'].rawScore, 10);
  assert.equal(results['Reading - Level B1 /21'].rawMaxScore, 21);
  assert.equal(results['Reading - Level B1 /21'].normalizedScore, 4.8);

  assert.equal(results['Tenses Các thì động từ /20'].rawScore, 11);
  assert.equal(results['Tenses Các thì động từ /20'].rawMaxScore, 20);
  assert.equal(results['Tenses Các thì động từ /20'].normalizedScore, 5.5);

  assert.equal(results['PET TEST 2 Reading /32'].rawScore, 17);
  assert.equal(results['PET TEST 2 Reading /32'].rawMaxScore, 32);
  assert.equal(results['PET TEST 2 Reading /32'].normalizedScore, 5.31);
});

test('v0.21 uses normalized source cell as primary when pairing to upgrade v0.20 score in place', () => {
  const csv = [
    'STT,Họ và Tên,15.8.2026,',
    ',,Tenses Các thì động từ /20,',
    '1,Cao Gia Linh,5.5,11',
  ].join('\n');
  const parsed = parseTeacherTrackingSheet(csv, { sourceId: 7 });
  const result = parsed.students[0].assessmentResults[0];
  assert.equal(result.primaryColumnIndex, 2);
  assert.ok(result.primaryObservationKey);
});

test('unresolved numbers without a denominator remain staging-only', () => {
  const result = inferAssessmentResult({
    rawMaxScore: null,
    columns: [{ index: 0 }],
  }, ['35']);
  assert.equal(result.normalizedScore, null);
  assert.match(result.warning, /chưa xác định được thang điểm/i);
});
