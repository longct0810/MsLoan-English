const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('v0.23.1 moves account actions to top-right navbar dropdown', () => {
  const view = read('src/views/partials/app-start.ejs');
  assert.match(view, /dropdown account-menu/);
  assert.match(view, /data-bs-toggle="dropdown"/);
  assert.match(view, /href="\/account\/password"/);
  assert.match(view, /action="\/logout"/);
  assert.match(view, /name="_csrf"/);
  assert.doesNotMatch(view, /sidebar-bottom/);
});

test('v0.23.1 sidebar navigation scrolls independently when menu is long', () => {
  const css = read('src/public/css/app.css');
  assert.match(css, /\.sidebar > \.nav/);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /\.account-dropdown/);
});
