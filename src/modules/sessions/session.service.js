const repo = require('./session.repository');
const classService = require('../classes/class.service');

const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ABSENT_EXCUSED', 'ONLINE'];
const NOTE_CATEGORIES = ['GENERAL', 'PROGRESS', 'BEHAVIOR', 'HOMEWORK', 'SPEAKING', 'LISTENING'];

async function getPageData({ classId, teacherId }) {
  const [sessions, classes] = await Promise.all([
    repo.findAll({ classId, teacherId }),
    classService.getClasses(),
  ]);
  return { sessions, classes };
}

async function getCreateData() {
  return { classes: await classService.getClasses() };
}

async function getSession(id) {
  return repo.findById(id);
}

async function createSession(input, teacherId) {
  if (!input.classId) throw new Error('Vui lòng chọn lớp học.');
  if (!input.sessionDate) throw new Error('Vui lòng chọn ngày học.');
  if (!input.topic?.trim()) throw new Error('Vui lòng nhập nội dung/chủ đề buổi học.');
  return repo.create({
    classId: input.classId,
    sessionDate: input.sessionDate,
    startTime: input.startTime || '',
    endTime: input.endTime || '',
    topic: input.topic.trim(),
    lessonSummary: input.lessonSummary?.trim() || '',
    homework: input.homework?.trim() || '',
  }, teacherId);
}

async function saveAttendance(sessionId, body) {
  const session = await repo.findById(sessionId);
  if (!session) throw new Error('SESSION_NOT_FOUND');
  const records = session.students.map((student) => {
    const status = body[`status_${student.id}`] || 'PRESENT';
    return {
      studentId: student.id,
      status: ATTENDANCE_STATUSES.includes(status) ? status : 'PRESENT',
      note: String(body[`note_${student.id}`] || '').trim().slice(0, 500),
    };
  });
  await repo.saveAttendance(sessionId, records);
}

async function addStudentNote(sessionId, input, authorName) {
  if (!input.studentId) throw new Error('Vui lòng chọn học viên.');
  const note = String(input.note || '').trim();
  if (!note) throw new Error('Vui lòng nhập nội dung nhận xét.');
  const category = NOTE_CATEGORIES.includes(input.category) ? input.category : 'GENERAL';
  return repo.addNote(sessionId, {
    studentId: input.studentId,
    note: note.slice(0, 3000),
    category,
    isParentVisible: input.isParentVisible === 'on' || input.isParentVisible === true,
  }, authorName);
}

async function completeSession(sessionId) {
  return repo.complete(sessionId);
}

module.exports = {
  getPageData,
  getCreateData,
  getSession,
  createSession,
  saveAttendance,
  addStudentNote,
  completeSession,
};
