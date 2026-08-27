process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const portalService = require('../src/modules/portal/portal.service');

test('marks a parent notification as read for that parent', async () => {
  const first = await portalService.getParentNotifications(3, 5);
  const unread = first.notifications.find((item) => !item.isRead);
  assert.ok(unread);

  await portalService.markParentNotificationRead(3, unread.key);
  const second = await portalService.getParentNotifications(3, 5);
  const marked = second.notifications.find((item) => item.key === unread.key);
  assert.equal(marked.isRead, true);
  assert.equal(second.unreadCount, first.unreadCount - 1);
});

test('rejects an invalid notification key', async () => {
  await assert.rejects(() => portalService.markParentNotificationRead(3, ''), /INVALID_NOTIFICATION/);
});
