'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSyncTimes, getNextRunAt } = require('../src/jobs/google-sheet-sync.job');

const timezone = 'Asia/Ho_Chi_Minh';

test('defaults to two daily sync times and validates configured times', () => {
  assert.deepEqual(parseSyncTimes(), ['11:00', '23:00']);
  assert.deepEqual(parseSyncTimes('23:00,11:00,11:00'), ['11:00', '23:00']);
  assert.throws(() => parseSyncTimes('25:00'), /Invalid Google Sheets sync time/);
});

test('schedules for 11:00 local time when before the morning run', () => {
  const next = getNextRunAt(new Date('2026-10-06T03:59:00Z'), timezone);
  assert.equal(next.toISOString(), '2026-10-06T04:00:00.000Z');
});

test('moves to the 23:00 run when the 11:00 run has passed', () => {
  const next = getNextRunAt(new Date('2026-10-06T04:00:30Z'), timezone);
  assert.equal(next.toISOString(), '2026-10-06T16:00:00.000Z');
});

test('moves to the following day after the 23:00 run has passed', () => {
  const next = getNextRunAt(new Date('2026-10-06T16:10:00Z'), timezone);
  assert.equal(next.toISOString(), '2026-10-07T04:00:00.000Z');
});
