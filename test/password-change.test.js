process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const demoStore = require('../src/shared/demo-store');
const authService = require('../src/modules/auth/auth.service');

const userId = 991;
const username = 'password-change-test';
const originalPassword = 'Original123!';
const newPassword = 'NewPassword456!';

let originalHash;

test.before(() => {
  originalHash = bcrypt.hashSync(originalPassword, 4);
  demoStore.users.push({
    id: userId,
    fullName: 'Password Change Test',
    username,
    email: 'password-change-test@example.com',
    passwordHash: originalHash,
    role: 'STUDENT',
    status: 'ACTIVE',
  });
});

test.after(() => {
  demoStore.users = demoStore.users.filter((item) => item.id !== userId);
});

test('rejects an incorrect current password', async () => {
  await assert.rejects(
    () => authService.changePassword(userId, 'WrongPassword!', newPassword, newPassword),
    /CURRENT_PASSWORD_INVALID/,
  );
});

test('rejects a short or mismatched new password', async () => {
  await assert.rejects(
    () => authService.changePassword(userId, originalPassword, 'short', 'short'),
    /PASSWORD_TOO_SHORT/,
  );

  await assert.rejects(
    () => authService.changePassword(userId, originalPassword, newPassword, 'DifferentPassword456!'),
    /PASSWORD_CONFIRM_MISMATCH/,
  );
});

test('changes password and invalidates the old credential', async () => {
  const before = await authService.login(username, originalPassword);
  assert.equal(before?.id, userId);

  await authService.changePassword(userId, originalPassword, newPassword, newPassword);

  const oldLogin = await authService.login(username, originalPassword);
  const newLogin = await authService.login(username, newPassword);

  assert.equal(oldLogin, null);
  assert.equal(newLogin?.id, userId);
});
