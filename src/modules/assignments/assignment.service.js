const repo = require('./assignment.repository');

function clean(value) { return String(value || '').trim(); }

function normalizeDueAt(value) {
  const text = clean(value);
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_DUE_AT');
  return date.toISOString();
}

function statusMeta(status) {
  const map = {
    NOT_STARTED: { label: 'Chưa làm', className: 'text-bg-warning' },
    SUBMITTED: { label: 'Đã nộp', className: 'text-bg-primary' },
    LATE: { label: 'Nộp trễ', className: 'text-bg-danger' },
    GRADED: { label: 'Đã chấm', className: 'text-bg-success' },
  };
  return map[status] || { label: status, className: 'text-bg-secondary' };
}

async function list(filters) {
  const [assignments, classes] = await Promise.all([repo.findAll(filters), repo.findClasses()]);
  return { assignments, classes };
}

async function newForm(query = {}) {
  const [classes, lessons] = await Promise.all([repo.findClasses(), repo.findLessons()]);
  return { classes, lessons };
}

async function create(body, userId) {
  const classId = Number(body.classId);
  const lessonId = body.lessonId ? Number(body.lessonId) : null;
  const title = clean(body.title);
  const maxScore = Number(body.maxScore || 10);
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('CLASS_REQUIRED');
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) throw new Error('INVALID_MAX_SCORE');
  return repo.create({
    classId,
    lessonId: Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null,
    title,
    description: clean(body.description),
    instructions: clean(body.instructions),
    type: ['HOMEWORK', 'PRACTICE', 'QUIZ'].includes(body.type) ? body.type : 'HOMEWORK',
    dueAt: normalizeDueAt(body.dueAt),
    maxScore,
  }, userId);
}


async function editForm(id) {
  const assignment = await repo.findById(id);
  if (!assignment) return { assignment: null, classes: [], lessons: [] };
  const [classes, lessons] = await Promise.all([repo.findClasses(), repo.findLessons()]);
  return { assignment, classes, lessons };
}

async function update(id, body) {
  const existing = await repo.findById(id);
  if (!existing) throw new Error('ASSIGNMENT_NOT_FOUND');
  const classId = Number(existing.classId);
  const lessonId = body.lessonId ? Number(body.lessonId) : null;
  const title = clean(body.title);
  const maxScore = Number(body.maxScore || 10);
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) throw new Error('INVALID_MAX_SCORE');
  return repo.update(id, {
    classId,
    lessonId: Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null,
    title,
    description: clean(body.description),
    instructions: clean(body.instructions),
    type: ['HOMEWORK','PRACTICE','QUIZ'].includes(body.type) ? body.type : 'HOMEWORK',
    dueAt: normalizeDueAt(body.dueAt),
    maxScore,
  });
}

async function detail(id) {
  const assignment = await repo.findById(id);
  if (assignment) {
    assignment.students = assignment.students.map((student) => ({
      ...student,
      submission: { ...student.submission, statusMeta: statusMeta(student.submission.status) },
    }));
  }
  return assignment;
}

async function publish(id) { return repo.publish(id); }

async function grade(id, studentId, body) {
  const assignment = await repo.findById(id);
  if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > Number(assignment.maxScore)) throw new Error('INVALID_SCORE');
  return repo.grade(id, studentId, { score, teacherFeedback: clean(body.teacherFeedback) });
}

async function getStudentAssignment(id, userId) {
  const assignment = await repo.findStudentAssignment(id, userId);
  if (assignment) assignment.submission.statusMeta = statusMeta(assignment.submission.status);
  return assignment;
}

async function submitStudentAssignment(id, userId, body) {
  return repo.submitStudentAssignment(id, userId, clean(body.submissionText));
}

module.exports = { list, newForm, create, editForm, update, detail, publish, grade, getStudentAssignment, submitStudentAssignment, statusMeta };
