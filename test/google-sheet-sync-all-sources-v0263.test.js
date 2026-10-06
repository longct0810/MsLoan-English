'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('fixed schedule synchronizes every enabled source, regardless of legacy interval', () => {
  const scheduler = read('src/jobs/google-sheet-sync.job.js');
  const service = read('src/modules/data-sources/google-sheet.service.js');
  const repository = read('src/modules/data-sources/google-sheet.repository.js');

  assert.match(scheduler, /service\.syncAllSources\(\)/);
  assert.doesNotMatch(scheduler, /syncDueSources|setInterval/);
  assert.match(service, /async function syncAllSources\(\)/);
  assert.match(service, /repository\.listEnabledSources\(\)/);

  const methodStart = repository.indexOf('async listEnabledSources()');
  const methodEnd = repository.indexOf('async listDueSources()', methodStart);
  assert.ok(methodStart >= 0 && methodEnd > methodStart);
  assert.doesNotMatch(repository.slice(methodStart, methodEnd), /sync_interval_minutes/);
});
