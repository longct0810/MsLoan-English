const env = require('../../config/env');
const repo = require('./class.repository');

function normalize(body) {
  return {
    name: String(body.name || '').trim(),
    grade: Number(body.grade || 0),
    schoolYear: String(body.schoolYear || env.academic.defaultSchoolYear).trim(),
    schedule: String(body.schedule || '').trim(),
    status: ['ACTIVE', 'INACTIVE'].includes(body.status) ? body.status : 'ACTIVE',
  };
}
function validate(data) {
  const errors = [];
  if (!data.name) errors.push('Tên lớp là bắt buộc.');
  if (![6, 7, 8, 9].includes(data.grade)) errors.push('Khối lớp phải là 6, 7, 8 hoặc 9.');
  if (!data.schoolYear) errors.push('Năm học là bắt buộc.');
  return errors;
}
async function getClasses() { return repo.findAll(); }
async function getGrades() { return repo.findGrades(); }
async function getClassDetail(id) { return repo.findById(id); }
async function getFormData(id = null) {
  const [classItem, grades] = await Promise.all([id ? repo.findById(id) : null, repo.findGrades()]);
  return { classItem, grades };
}
async function createClass(body, actorUserId) {
  const data = normalize(body); const errors = validate(data);
  if (errors.length) return { errors, data };
  try { return { classItem: await repo.create(data, actorUserId), data }; }
  catch (error) { return { errors: [error.message], data }; }
}
async function updateClass(id, body) {
  const data = normalize(body); const errors = validate(data);
  if (errors.length) return { errors, data };
  try { return { classItem: await repo.update(id, data), data }; }
  catch (error) { return { errors: [error.message], data }; }
}
async function deleteClass(id) { return repo.softDelete(id); }
module.exports = { getClasses, getGrades, getClassDetail, getFormData, createClass, updateClass, deleteClass };
