const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const repo = require('./auth.repository');
const { normalizeUsername } = require('../../shared/account-identifiers');

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

async function login(username, password) {
  const normalized = normalizeUsername(username);
  const user = await repo.findByUsername(normalized);
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  };
}

function validateNewPassword(currentPassword, newPassword, confirmPassword) {
  if (!currentPassword) throw new Error('CURRENT_PASSWORD_REQUIRED');
  if (!newPassword) throw new Error('NEW_PASSWORD_REQUIRED');
  if (newPassword.length < MIN_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_SHORT');
  if (newPassword.length > MAX_PASSWORD_LENGTH) throw new Error('PASSWORD_TOO_LONG');
  if (newPassword !== confirmPassword) throw new Error('PASSWORD_CONFIRM_MISMATCH');
  if (newPassword === currentPassword) throw new Error('PASSWORD_UNCHANGED');
}

async function changePassword(userId, currentPassword, newPassword, confirmPassword) {
  validateNewPassword(currentPassword, newPassword, confirmPassword);

  const user = await repo.findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentMatches) throw new Error('CURRENT_PASSWORD_INVALID');

  const newMatchesCurrentHash = await bcrypt.compare(newPassword, user.passwordHash);
  if (newMatchesCurrentHash) throw new Error('PASSWORD_UNCHANGED');

  const passwordHash = await bcrypt.hash(newPassword, env.security.bcryptRounds);
  const updated = await repo.updatePassword(user.id, passwordHash);
  if (!updated) throw new Error('USER_NOT_FOUND');

  return true;
}

module.exports = {
  login,
  changePassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
