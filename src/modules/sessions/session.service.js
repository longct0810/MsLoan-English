const repo = require('./session.repository');
const classService = require('../classes/class.service');

const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ABSENT_EXCUSED', 'ONLINE'];
const NOTE_CATEGORIES = ['GENERAL', 'PROGRESS', 'BEHAVIOR', 'HOMEWORK', 'SPEAKING', 'LISTENING'];

async function getPageData({ classId } = {}, actorUserId = null, isAdmin = false) {
  const [sessions, classes] = await Promise.all([
    repo.findAll({ classId }, actorUserId, isAdmin),
    classService.getClasses(actorUserId, isAdmin),
  ]);
  return { sessions, classes };
}

async function getCreateData(actorUserId = null, isAdmin = false) {
  return { classes: await classService.getClasses(actorUserId, isAdmin) };
}

async function getSession(id, actorUserId = null, isAdmin = false) {
  return repo.findById(id, actorUserId, isAdmin);
}

async function createSession(input, actorUserId, isAdmin = false) {
  if (!input.classId) throw new Error('Vui lòng chọn lớp học.');
  if (!input.sessionDate) throw new Error('Vui lòng chọn ngày học.');
  if (!input.topic?.trim()) throw new Error('Vui lòng nhập nội dung/chủ đề buổi học.');
  if (!await classService.getClassDetail(input.classId, actorUserId, isAdmin)) throw new Error('CLASS_NOT_FOUND');
  return repo.create({
    classId: input.classId,
    sessionDate: input.sessionDate,
    startTime: input.startTime || '',
    endTime: input.endTime || '',
    topic: input.topic.trim(),
    lessonSummary: input.lessonSummary?.trim() || '',
    homework: input.homework?.trim() || '',
  }, actorUserId, isAdmin);
}

async function saveAttendance(sessionId, body, actorUserId, isAdmin = false) {
  const session = await repo.findById(sessionId, actorUserId, isAdmin);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const records = session.students.map((student) => {
    const status = body[`status_${student.id}`] || 'PRESENT';
    return {
      studentId: student.id,
      status: ATTENDANCE_STATUSES.includes(status) ? status : 'PRESENT',
      note: String(body[`note_${student.id}`] || '').trim().slice(0, 500),
    };
  });
  await repo.saveAttendance(sessionId, records, actorUserId, isAdmin);
}

async function addStudentNote(sessionId, input, authorName, actorUserId, isAdmin = false) {
  if (!await repo.findById(sessionId, actorUserId, isAdmin)) throw new Error('SESSION_NOT_FOUND');
  if (!input.studentId) throw new Error('Vui lòng chọn học viên.');
  const note = String(input.note || '').trim();
  if (!note) throw new Error('Vui lòng nhập nội dung nhận xét.');
  const category = NOTE_CATEGORIES.includes(input.category) ? input.category : 'GENERAL';
  return repo.addNote(sessionId, {
    studentId: input.studentId,
    note: note.slice(0, 3000),
    category,
    isParentVisible: input.isParentVisible === 'on' || input.isParentVisible === true,
  }, authorName, actorUserId, isAdmin);
}

async function saveJournal(sessionId, input, actorUserId, isAdmin = false) {
  if (!await repo.findById(sessionId, actorUserId, isAdmin)) throw new Error('SESSION_NOT_FOUND');
  const clean = (value, max = 5000) => String(value || '').trim().slice(0, max);
  return repo.saveJournal(sessionId, {
    sessionGoal: clean(input.sessionGoal, 3000),
    lessonSummary: clean(input.lessonSummary, 8000),
    homework: clean(input.homework, 5000),
    teacherSummary: clean(input.teacherSummary, 8000),
    parentSummary: clean(input.parentSummary, 5000),
    nextSessionPlan: clean(input.nextSessionPlan, 5000),
    parentPublished: input.parentPublished === 'on' || input.parentPublished === true,
  }, actorUserId, isAdmin);
}

async function copyPreviousJournal(sessionId, actorUserId, isAdmin = false) {
  return repo.copyPreviousJournal(sessionId, actorUserId, isAdmin);
}

async function completeSession(sessionId, actorUserId, isAdmin = false) {
  if (!await repo.findById(sessionId, actorUserId, isAdmin)) throw new Error('SESSION_NOT_FOUND');
  return repo.complete(sessionId, actorUserId, isAdmin);
}

module.exports = {
  getPageData,
  getCreateData,
  getSession,
  createSession,
  saveAttendance,
  addStudentNote,
  saveJournal,
  copyPreviousJournal,
  completeSession,
};
