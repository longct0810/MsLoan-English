const repo = require('./class.repository');

async function getClasses() {
  return repo.findAll();
}

async function getClassDetail(id) {
  return repo.findById(id);
}

module.exports = { getClasses, getClassDetail };
