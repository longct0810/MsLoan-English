const bcrypt = require('bcryptjs');
const repo = require('./auth.repository');

async function login(email, password) {
  const user = await repo.findByEmail(email);
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

module.exports = { login };
