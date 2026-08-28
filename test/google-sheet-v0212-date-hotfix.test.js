'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDateOnly, isDateAllowed } = require('../src/modules/data-sources/google-sheet.service');

test('v0.21.2 normalizes PostgreSQL DATE values returned as JavaScript Date', () => {
  const value = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(normalizeDateOnly(value), '2026-01-01');
});

test('v0.21.2 does not compare ISO observed_on against Date.toString prefixes', () => {
  const source = {
    import_from_date: new Date('2026-01-01T00:00:00.000Z'),
    import_to_date: null,
    settings: { skip_future_dates: false },
  };
  const result = isDateAllowed(source, '2026-08-13');
  assert.equal(result.allowed, true);
  assert.equal(result.warning, null);
});

test('v0.21.2 still blocks dates before normalized import_from_date', () => {
  const source = {
    import_from_date: new Date('2026-01-01T00:00:00.000Z'),
    settings: { skip_future_dates: false },
  };
  const result = isDateAllowed(source, '2025-07-09');
  assert.equal(result.allowed, false);
  assert.match(result.warning, /2026-01-01/);
});

test('v0.21.2 normalizes string timestamps for import_to_date', () => {
  const source = {
    import_to_date: '2026-12-31T00:00:00.000Z',
    settings: { skip_future_dates: false },
  };
  assert.equal(isDateAllowed(source, '2026-08-13').allowed, true);
  assert.equal(isDateAllowed(source, '2027-01-01').allowed, false);
});
