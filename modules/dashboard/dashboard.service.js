const repo = require('./dashboard.repository');

async function getDashboard() {
  return repo.getSummary();
}

module.exports = { getDashboard };
