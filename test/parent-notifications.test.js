process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const portalService = require('../src/modules/portal/portal.service');

test('builds notifications only for the authorized parent child', async () => {
  const result = await portalService.getParentNotifications(3, 5);
  assert.equal(result.selected.id, 5);
  assert.ok(result.notifications.length > 0);
  assert.ok(result.notifications.every((item) => !item.body.includes('Lê Hoàng Nam')));
  assert.ok(result.notifications.some((item) => item.title === 'Cập nhật chuyên cần'));
});

test('falls back to the first authorized child for invalid selection', async () => {
  const result = await portalService.getParentNotifications(3, 999);
  assert.equal(result.selected.id, 3);
});
