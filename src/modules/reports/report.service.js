const repo = require('./report.repository');

function normalizeMonth(value) {
  return repo.monthRange(value).month;
}

async function getReport(actorUserId, isAdmin = false, filters = {}) {
  return repo.getReportData(actorUserId, isAdmin, normalizeMonth(filters.month), filters.classId || null);
}

async function getStudentReport(actorUserId, isAdmin = false, studentId, filters = {}) {
  return repo.getStudentDetail(actorUserId, isAdmin, studentId, filters.classId, normalizeMonth(filters.month));
}

module.exports = { getReport, getStudentReport, normalizeMonth };
