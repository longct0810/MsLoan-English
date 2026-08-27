const repo = require('./assignment.repository');
const classService = require('../classes/class.service');
const skillRepo = require('../skills/skill.repository');

async function canAccess(assignment, userId, isAdmin) {
  return Boolean(assignment && (isAdmin || await classService.getClassDetail(assignment.classId, userId, false)));
}

function clean(value) { return String(value || '').trim(); }
function submissionMode(value){return ['TEXT','FILE','AUDIO','MIXED'].includes(String(value||'').toUpperCase())?String(value).toUpperCase():'TEXT';}
function checked(value){return value==='on'||value===true||value==='true'||value==='1';}

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
  return { classes, lessons, skills: await skillRepo.findSkills() };
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
  const created = await repo.create({
    classId,
    lessonId: Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null,
    title,
    description: clean(body.description),
    instructions: clean(body.instructions),
    type: ['HOMEWORK', 'PRACTICE', 'QUIZ'].includes(body.type) ? body.type : 'HOMEWORK',
    dueAt: normalizeDueAt(body.dueAt),
    maxScore,
    submissionMode: submissionMode(body.submissionMode),
    rubricEnabled: checked(body.rubricEnabled),
  }, userId);
  await skillRepo.setAssignmentSkills(created.id, body.skillCodes);
  created.skillCodes = await skillRepo.getAssignmentSkills(created.id);
  return created;
}


async function editForm(id, userId, isAdmin = false) {
  const assignment = await detail(id, userId, isAdmin);
  if (!assignment) return { assignment: null, classes: [], lessons: [] };
  const [formData, lessons, selectedSkillCodes] = await Promise.all([newForm({}, userId, isAdmin), getAccessibleLessons(userId, isAdmin, assignment.classId), skillRepo.getAssignmentSkills(assignment.id)]);
  return { assignment: {...assignment, skillCodes:selectedSkillCodes}, classes:formData.classes, lessons, skills:formData.skills };
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
  const updated = await repo.update(id, {
    classId,
    lessonId: Number.isInteger(lessonId) && lessonId > 0 ? lessonId : null,
    title,
    description: clean(body.description),
    instructions: clean(body.instructions),
    type: ['HOMEWORK','PRACTICE','QUIZ'].includes(body.type) ? body.type : 'HOMEWORK',
    dueAt: normalizeDueAt(body.dueAt),
    maxScore,
    submissionMode: submissionMode(body.submissionMode),
    rubricEnabled: checked(body.rubricEnabled),
  });
  await skillRepo.setAssignmentSkills(id, body.skillCodes);
  return updated;
}

async function detail(id, userId, isAdmin = false) {
  const assignment = await repo.findById(id);
  if (!await canAccess(assignment, userId, isAdmin)) return null;
  if (assignment) {
    assignment.skillCodes = await skillRepo.getAssignmentSkills(assignment.id);
    assignment.skillCatalog = await skillRepo.findSkills();
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
  let score; const rubricScores={};
  if (assignment.rubricEnabled && assignment.skillCodes.length) {
    const perMax=Number(assignment.maxScore)/assignment.skillCodes.length;
    for(const code of assignment.skillCodes){const value=Number(body[`rubric_${code}`]);if(!Number.isFinite(value)||value<0||value>perMax+0.0001)throw new Error('RUBRIC_REQUIRED');rubricScores[code]=Number(value.toFixed(2));}
    score=Number(Object.values(rubricScores).reduce((sum,v)=>sum+v,0).toFixed(2));
  } else score=Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > Number(assignment.maxScore)+0.0001) throw new Error('INVALID_SCORE');
  const graded = await repo.grade(id, studentId, { score, teacherFeedback: clean(body.teacherFeedback), rubricScores, rubricFeedback: clean(body.rubricFeedback) });
  await skillRepo.recordAssignmentGrade(id, studentId);
  return graded;
}

async function getStudentAssignment(id, userId) {
  const assignment = await repo.findStudentAssignment(id, userId);
  if (assignment) assignment.submission.statusMeta = statusMeta(assignment.submission.status);
  return assignment;
}

async function submitStudentAssignment(id, userId, body, files=[]) {
  return repo.submitStudentAssignment(id, userId, { submissionText: clean(body.submissionText), files });
}

async function getAsset(assignmentId, assetId, userId, role) {
  const isAdmin=role==='ADMIN';
  let assignment; if(role==='STUDENT') assignment=await getStudentAssignment(assignmentId,userId); else assignment=await detail(assignmentId,userId,isAdmin);
  if(!assignment) return null; const asset=await repo.findAsset(assetId,assignmentId); if(!asset)return null;
  if(role==='STUDENT' && Number(asset.studentId)!==Number(assignment.student.id)) return null; return asset;
}

module.exports = { list, newForm, create, editForm, update, detail, publish, grade, getStudentAssignment, submitStudentAssignment, getAsset, statusMeta };
