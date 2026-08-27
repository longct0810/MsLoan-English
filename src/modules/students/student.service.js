const repo = require('./student.repository');
const classService = require('../classes/class.service');

function normalize(body) {
  return {
    fullName: String(body.fullName || '').trim(),
    dateOfBirth: String(body.dateOfBirth || '').trim(),
    school: String(body.school || '').trim(),
    schoolClass: String(body.schoolClass || '').trim(),
    phone: String(body.phone || '').trim(),
    studentEmail: String(body.studentEmail || '').trim().toLowerCase(),
    studentPassword: String(body.studentPassword || ''),
    parentName: String(body.parentName || '').trim(),
    parentPhone: String(body.parentPhone || '').trim(),
    parentEmail: String(body.parentEmail || '').trim().toLowerCase(),
    parentPassword: String(body.parentPassword || ''),
    relationship: String(body.relationship || 'Bố/Mẹ').trim(),
    classIds: Array.isArray(body.classIds) ? body.classIds.filter(Boolean) : (body.classIds ? [body.classIds] : []),
  };
}

function validate(data, { creating = false } = {}) {
  const errors = [];
  if (!data.fullName) errors.push('Họ tên học viên là bắt buộc.');
  if (!/^\S+@\S+\.\S+$/.test(data.studentEmail)) errors.push('Email đăng nhập học viên không hợp lệ.');
  if (!data.parentName) errors.push('Họ tên phụ huynh là bắt buộc.');
  if (!/^\S+@\S+\.\S+$/.test(data.parentEmail)) errors.push('Email phụ huynh không hợp lệ.');
  if (creating && data.studentPassword.length < 8) errors.push('Mật khẩu học viên phải có ít nhất 8 ký tự.');
  if (!creating && data.studentPassword && data.studentPassword.length < 8) errors.push('Mật khẩu học viên mới phải có ít nhất 8 ký tự.');
  if (data.parentPassword && data.parentPassword.length < 8) errors.push('Mật khẩu phụ huynh mới phải có ít nhất 8 ký tự.');
  if (data.studentEmail && data.parentEmail && data.studentEmail === data.parentEmail) errors.push('Email học viên và email phụ huynh phải khác nhau.');
  if (!data.classIds.length) errors.push('Hãy chọn ít nhất một lớp cho học viên.');
  return errors;
}

async function getStudents(filters, actorUserId, isAdmin = false) {
  return repo.findAll(filters, actorUserId, isAdmin);
}

async function getStudentPageData(filters, actorUserId, isAdmin = false) {
  const [students, classes] = await Promise.all([
    repo.findAll(filters, actorUserId, isAdmin),
    classService.getClasses(actorUserId, isAdmin),
  ]);
  return { students, classes };
}

async function getFormData(id = null, actorUserId = null, isAdmin = false) {
  const [student, classes] = await Promise.all([
    id ? repo.findById(id, actorUserId, isAdmin) : null,
    classService.getClasses(actorUserId, isAdmin),
  ]);
  return { student, classes };
}

async function createStudent(body, actorUserId, isAdmin = false) {
  const data = normalize(body);
  const errors = validate(data, { creating: true });
  if (errors.length) return { errors, data };
  try { return { student: await repo.create(data, actorUserId, isAdmin), data }; }
  catch (error) { return { errors: [error.message === 'CLASS_NOT_FOUND' ? 'Một hoặc nhiều lớp không thuộc phạm vi quản lý của bạn.' : error.message], data }; }
}

async function updateStudent(id, body, actorUserId, isAdmin = false) {
  const data = normalize(body);
  const errors = validate(data);
  if (errors.length) return { errors, data };
  try { return { student: await repo.update(id, data, actorUserId, isAdmin), data }; }
  catch (error) { return { errors: [error.message === 'CLASS_NOT_FOUND' ? 'Một hoặc nhiều lớp không thuộc phạm vi quản lý của bạn.' : error.message], data }; }
}

async function deleteStudent(id, actorUserId, isAdmin = false) {
  return repo.softDelete(id, actorUserId, isAdmin);
}

module.exports = {
  getStudents,
  getStudentPageData,
  getFormData,
  createStudent,
  updateStudent,
  deleteStudent,
};
