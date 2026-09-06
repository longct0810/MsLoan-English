const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 50;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateUsername(username) {
  if (!username) return 'Tên tài khoản là bắt buộc.';
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
    return `Tên tài khoản phải từ ${USERNAME_MIN_LENGTH} đến ${USERNAME_MAX_LENGTH} ký tự.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Tên tài khoản chỉ được gồm chữ thường a-z, số, dấu chấm, gạch dưới hoặc gạch ngang.';
  }
  return null;
}

function buildStudentCode(grade, studentId) {
  const gradeNo = Number(grade);
  const id = Number(studentId);
  if (![6, 7, 8, 9].includes(gradeNo) || !Number.isInteger(id) || id <= 0) {
    throw new Error('STUDENT_CODE_INVALID_INPUT');
  }
  return `Y${gradeNo}_HS${id}`;
}

function buildTransferCode(periodMonth, studentCode) {
  const match = String(periodMonth || '').match(/^(\d{4})-(\d{2})/);
  const code = String(studentCode || '').trim().toUpperCase();
  if (!match || !/^Y(?:6|7|8|9)_HS\d+$/.test(code)) return '';
  return `HP ${match[1]}${match[2]} ${code}`;
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeUsername,
  validateUsername,
  buildStudentCode,
  buildTransferCode,
};
