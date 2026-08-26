const repo = require('./student.repository');
const classService = require('../classes/class.service');

async function getStudents(filters) {
  return repo.findAll(filters);
}

async function getStudentPageData(filters) {
  const [students, classes] = await Promise.all([
    repo.findAll(filters),
    classService.getClasses(),
  ]);
  return { students, classes };
}

module.exports = { getStudents, getStudentPageData };
