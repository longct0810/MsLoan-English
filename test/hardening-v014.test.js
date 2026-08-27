process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const demoStore = require('../src/shared/demo-store');
const studentService = require('../src/modules/students/student.service');
const sessionService = require('../src/modules/sessions/session.service');
const dashboardService = require('../src/modules/dashboard/dashboard.service');
const assignmentService = require('../src/modules/assignments/assignment.service');
const examService = require('../src/modules/exams/exam.service');
const questionService = require('../src/modules/questions/question.service');
const questionRepo = require('../src/modules/questions/question.repository');

const fixtureIds = { classId: 99, studentId: 99, sessionId: 99, lessonId: 99, questionId: 99 };

test.before(() => {
  demoStore.classes.push({
    id: fixtureIds.classId,
    name: 'Other Teacher Class',
    grade: 7,
    schoolYear: '2026-2027',
    schedule: 'Test',
    status: 'ACTIVE',
    teacherId: 999,
  });
  demoStore.students.push({
    id: fixtureIds.studentId,
    fullName: 'Other Teacher Student',
    school: 'Test School',
    schoolClass: '7Z',
    status: 'ACTIVE',
    classIds: [fixtureIds.classId],
    averageScore: 9,
    attendanceRate: 100,
  });
  demoStore.classSessions.push({
    id: fixtureIds.sessionId,
    classId: fixtureIds.classId,
    teacherId: 999,
    sessionDate: '2026-08-27',
    startTime: '18:00',
    endTime: '19:00',
    topic: 'Other teacher session',
    lessonSummary: '',
    homework: '',
    status: 'PLANNED',
  });
  demoStore.lessons.push({
    id: fixtureIds.lessonId,
    classId: fixtureIds.classId,
    unitName: 'Unit X',
    title: 'Private Lesson',
    status: 'PUBLISHED',
    sortOrder: 1,
  });
  demoStore.questions.push({
    id: fixtureIds.questionId,
    gradeId: 7,
    grade: 7,
    lessonId: fixtureIds.lessonId,
    createdBy: 999,
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Private question?',
    correctAnswer: '',
    explanation: '',
    difficulty: 'MEDIUM',
    defaultPoints: 1,
    status: 'PUBLISHED',
  });
  demoStore.questionOptions.push(
    { id: 9901, questionId: fixtureIds.questionId, optionKey: 'A', optionText: 'Yes', isCorrect: true, sortOrder: 1 },
    { id: 9902, questionId: fixtureIds.questionId, optionKey: 'B', optionText: 'No', isCorrect: false, sortOrder: 2 },
  );
});

test.after(() => {
  demoStore.classes = demoStore.classes.filter((item) => item.id !== fixtureIds.classId);
  demoStore.students = demoStore.students.filter((item) => item.id !== fixtureIds.studentId);
  demoStore.classSessions = demoStore.classSessions.filter((item) => item.id !== fixtureIds.sessionId);
  demoStore.lessons = demoStore.lessons.filter((item) => item.id !== fixtureIds.lessonId);
  demoStore.questions = demoStore.questions.filter((item) => item.id !== fixtureIds.questionId);
  demoStore.questionOptions = demoStore.questionOptions.filter((item) => item.questionId !== fixtureIds.questionId);
});

test('student CRUD scope follows class ownership', async () => {
  const teacherOne = await studentService.getStudents({}, 1, false);
  const teacherOther = await studentService.getStudents({}, 999, false);
  assert.equal(teacherOne.some((item) => item.id === fixtureIds.studentId), false);
  assert.deepEqual(teacherOther.map((item) => item.id), [fixtureIds.studentId]);
  assert.equal((await studentService.getFormData(1, 999, false)).student, null);
});

test('session access and creation follow class ownership', async () => {
  assert.equal(await sessionService.getSession(1, 999, false), null);
  assert.equal((await sessionService.getSession(fixtureIds.sessionId, 999, false)).id, fixtureIds.sessionId);
  await assert.rejects(
    () => sessionService.createSession({ classId: 1, sessionDate: '2026-08-27', topic: 'Forbidden' }, 999, false),
    /CLASS_NOT_FOUND/,
  );
});

test('dashboard is scoped to the current teacher', async () => {
  const dashboard = await dashboardService.getDashboard(999, false);
  assert.equal(dashboard.classCount, 1);
  assert.equal(dashboard.studentCount, 1);
  assert.ok(dashboard.classes.every((item) => item.id === fixtureIds.classId));
  assert.ok(dashboard.sessions.every((item) => item.id === fixtureIds.sessionId));
});

test('assignment lesson must belong to the selected class', async () => {
  await assert.rejects(
    () => assignmentService.create({
      classId: 1,
      lessonId: fixtureIds.lessonId,
      title: 'Cross-class lesson test',
      maxScore: 10,
      type: 'HOMEWORK',
    }, 1, false),
    /LESSON_CLASS_MISMATCH/,
  );
});

test('exam update cannot move an exam to another teacher class', async () => {
  await assert.rejects(
    () => examService.update(1, {
      classId: fixtureIds.classId,
      title: 'Moved exam',
      durationMinutes: 20,
      maxAttempts: 1,
      questionIds: ['1'],
      showResult: 'on',
    }, 1, false),
    /CLASS_NOT_FOUND/,
  );
});

test('question update/import lookup is restricted by ownership', async () => {
  const denied = await questionRepo.findExistingIds([fixtureIds.questionId], 1, false);
  const allowed = await questionRepo.findExistingIds([fixtureIds.questionId], 999, false);
  assert.equal(denied.has(fixtureIds.questionId), false);
  assert.equal(allowed.has(fixtureIds.questionId), true);

  await assert.rejects(() => questionService.update(fixtureIds.questionId, {
    gradeId: 7,
    lessonId: fixtureIds.lessonId,
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Attempted update',
    defaultPoints: 1,
    difficulty: 'MEDIUM',
    correctOption: 'A',
    optionA: 'Yes',
    optionB: 'No',
  }, 1, false), /QUESTION_NOT_FOUND/);

  await assert.rejects(() => questionRepo.bulkUpsert([{
    action: 'UPDATE',
    id: fixtureIds.questionId,
    gradeId: 7,
    lessonId: fixtureIds.lessonId,
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Attempted bulk update',
    correctAnswer: '',
    explanation: '',
    difficulty: 'MEDIUM',
    defaultPoints: 1,
    correctOption: 'A',
    options: { A: 'Yes', B: 'No', C: '', D: '' },
    status: 'PUBLISHED',
    _hasLessonColumn: true,
    _hasDifficultyColumn: true,
  }], 1, false), /QUESTION_NOT_FOUND/);
});
