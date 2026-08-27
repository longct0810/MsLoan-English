const repo = require('./assignment.repository');
const classService = require('../classes/class.service');

async function canAccess(assignment, userId, isAdmin) {
  return Boolean(assignment && (isAdmin || await classService.getClassDetail(assignment.classId, userId, false)));
}

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


async function getAccessibleLessons(userId, isAdmin = false, classId = null) {
  const classes = isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false);
  const allowedClassIds = new Set(classes.map((item) => Number(item.id)));
  return (await repo.findLessons(classId))
    .filter((lesson) => allowedClassIds.has(Number(lesson.classId)));
}

async function validateLessonClass(lessonId, classId, userId, isAdmin = false) {
  if (!lessonId) return;
  const lessons = await getAccessibleLessons(userId, isAdmin, classId);
  if (!lessons.some((lesson) => Number(lesson.id) === Number(lessonId)
    && Number(lesson.classId) === Number(classId))) {
    throw new Error('LESSON_CLASS_MISMATCH');
  }
}

async function list(filters, userId, isAdmin = false) {
  const classes = isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false);
  const allowed = new Set(classes.map((item) => Number(item.id)));
  const assignments = (await repo.findAll(filters)).filter((item) => isAdmin || allowed.has(Number(item.classId)));
  return { assignments, classes };
}

async function newForm(query = {}, userId, isAdmin = false) {
  const classes = isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false);
  const selectedClassId = Number(query.classId || 0) || null;
  const lessons = await getAccessibleLessons(userId, isAdmin, selectedClassId);
  return { classes, lessons };
}

async function create(body, userId, isAdmin = false) {
  const classId = Number(body.classId);
  const lessonId = body.lessonId ? Number(body.lessonId) : null;
  const title = clean(body.title);
  const maxScore = Number(body.maxScore || 10);
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('CLASS_REQUIRED');
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!await classService.getClassDetail(classId, userId, isAdmin)) throw new Error('CLASS_NOT_FOUND');
  await validateLessonClass(lessonId, classId, userId, isAdmin);
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


async function editForm(id, userId, isAdmin = false) {
  const assignment = await detail(id, userId, isAdmin);
  if (!assignment) return { assignment: null, classes: [], lessons: [] };
  const [classes, lessons] = await Promise.all([newForm({}, userId, isAdmin).then((data) => data.classes), getAccessibleLessons(userId, isAdmin, assignment.classId)]);
  return { assignment, classes, lessons };
}

async function update(id, body, userId, isAdmin = false) {
  const existing = await detail(id, userId, isAdmin);
  if (!existing) throw new Error('ASSIGNMENT_NOT_FOUND');
  const classId = Number(existing.classId);
  const lessonId = body.lessonId ? Number(body.lessonId) : null;
  const title = clean(body.title);
  const maxScore = Number(body.maxScore || 10);
  if (!title) throw new Error('TITLE_REQUIRED');
  await validateLessonClass(lessonId, classId, userId, isAdmin);
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

async function detail(id, userId, isAdmin = false) {
  const assignment = await repo.findById(id);
  if (!await canAccess(assignment, userId, isAdmin)) return null;
  if (assignment) {
    assignment.students = assignment.students.map((student) => ({
      ...student,
      submission: { ...student.submission, statusMeta: statusMeta(student.submission.status) },
    }));
  }
  return assignment;
}

async function publish(id, userId, isAdmin = false) {
  if (!await detail(id, userId, isAdmin)) throw new Error('ASSIGNMENT_NOT_FOUND');
  return repo.publish(id);
}

async function grade(id, studentId, body, userId, isAdmin = false) {
  const assignment = await detail(id, userId, isAdmin);
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
