'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeSocialLink, zaloChatTarget } = require('../src/shared/social-links');

test('Zalo chat normalizes Vietnamese phone inputs and contact links', () => {
  for (const value of ['0901234567', '+84 901 234 567', '84901234567', 'https://zalo.me/0901234567']) {
    assert.equal(normalizeSocialLink(value, 'zaloUrl'), 'https://zalo.me/0901234567');
  }
  assert.deepEqual(zaloChatTarget('https://zalo.me/0901234567'), {
    appUrl: 'zalo://conversation?phone=0901234567', webUrl: 'https://zalo.me/0901234567',
  });
  assert.equal(normalizeSocialLink('', 'zaloUrl'), '');
  assert.throws(() => normalizeSocialLink('https://zalo.me/vi', 'zaloUrl'), /INVALID_ZALO_CHAT_LINK/);
});

test('Zalo app links cannot be built from untrusted domains or protocols', () => {
  for (const value of ['javascript:alert(1)', 'https://evil.example/0901234567', 'https://zalo.me.evil.example/0901234567', 'https://user@zalo.me/0901234567']) {
    assert.deepEqual(zaloChatTarget(value), { appUrl: '', webUrl: '' });
  }
  assert.deepEqual(zaloChatTarget('https://zalo.me/legacy-contact'), {
    appUrl: '', webUrl: 'https://zalo.me/legacy-contact',
  });
});

test('click exposes the manual fallback without interfering with native app navigation', () => {
  let onClick, removed;
  const fallback = { classList: { remove: value => { removed = value; } } };
  const button = {
    addEventListener: (event, listener) => { assert.equal(event, 'click'); onClick = listener; },
    parentElement: { querySelector: () => fallback },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/public/js/zalo-chat.js'), 'utf8'), {
    document: { querySelectorAll: () => [button] },
  });
  onClick();
  assert.equal(removed, 'd-none');
});
