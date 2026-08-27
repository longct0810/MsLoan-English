process.env.DEMO_MODE = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const classService = require('../src/modules/classes/class.service');
const lessonService = require('../src/modules/lessons/lesson.service');
const assignmentService = require('../src/modules/assignments/assignment.service');
const examService = require('../src/modules/exams/exam.service');

test('denies a teacher access to another teacher-owned class resources', async () => {
  assert.equal(await classService.getClassDetail(1, 999, false), null);
  assert.equal(await lessonService.detail(1, 999, false), null);
  assert.equal(await assignmentService.detail(1, 999, false), null);
  assert.equal(await examService.detail(1, 999, false), null);
});

test('allows the owning demo teacher to access class resources', async () => {
  assert.equal((await classService.getClassDetail(1, 1, false)).id, 1);
  assert.equal((await lessonService.detail(1, 1, false)).id, 1);
  assert.equal((await assignmentService.detail(1, 1, false)).id, 1);
  assert.equal((await examService.detail(1, 1, false)).id, 1);
});
