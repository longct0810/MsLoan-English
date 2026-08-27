const repo = require('./dashboard.repository');

async function getDashboard(actorUserId = null, isAdmin = false) {
  return repo.getSummary(actorUserId, isAdmin);
}

module.exports = { getDashboard };
