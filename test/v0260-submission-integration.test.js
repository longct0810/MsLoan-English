'use strict';

process.env.DEMO_MODE = 'true';
process.env.ASSIGNMENT_UPLOAD_MAX_FILE_MB = '1';
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env.example') });
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const store = require('../src/shared/demo-store');
const service = require('../src/modules/assignments/assignment.service');
const { inferAssessmentResult, parseTeacherTrackingSheet } = require('../src/modules/data-sources/google-sheet-csv');
const { prioritizeTeacherAssignments } = require('../src/shared/assignment-priority');

for (const status of [-1, -2]) {
  test(`Sheets preserves status ${status} with and without an explicit maximum`, () => {
    for (const max of [null, 20, 32]) {
      const result = inferAssessmentResult({ rawMaxScore: max, columns: [{ index: 0 }] }, [String(status)]);
      assert.equal(result.normalizedScore, status);
      assert.equal(result.rawMaxScore, null);
      assert.equal(result.warning, null);
    }
    const parsed = parseTeacherTrackingSheet(`STT,Họ và Tên,15.8.2026\n,,Reading /20\n1,Lê Hoàng Nam,${status}`, { sourceId: 7 });
    assert.equal(parsed.students[0].assessmentResults[0].normalizedScore, status);
  });
}

test('teacher follow-up work precedes drafts and completed assignments', () => {
  const rows = [
    { id: 1, status: 'PUBLISHED', total: 2, submitted: 2, graded: 2 },
    { id: 2, status: 'DRAFT' },
    { id: 3, status: 'PUBLISHED', total: 2, submitted: 1, graded: 1 },
    { id: 4, status: 'PUBLISHED', total: 2, submitted: 2, graded: 1 },
  ];
  assert.deepEqual(prioritizeTeacherAssignments(rows).map(row => row.id), [3, 4, 2, 1]);
  assert.equal(rows[0].id, 1);
});

test('all assignment categories accept text, files, audio and mixed submissions', async () => {
  const audio = { originalname: 'answer.ogg', mimetype: 'audio/ogg', buffer: Buffer.from('audio'), size: 5 };
  const document = { originalname: 'answer.pdf', mimetype: 'application/pdf', buffer: Buffer.from('file'), size: 4 };
  for (const type of ['HOMEWORK', 'PRACTICE', 'QUIZ']) {
    for (const mode of ['TEXT', 'FILE', 'AUDIO', 'MIXED']) {
      const assignment = await service.create({ classId: 2, title: `${type}-${mode}`, type, submissionMode: mode }, 1);
      await service.publish(assignment.id, 1);
      const requiredError = mode === 'FILE' ? /FILE_REQUIRED/ : mode === 'AUDIO' ? /AUDIO_REQUIRED/ : /SUBMISSION_REQUIRED/;
      await assert.rejects(service.submitStudentAssignment(assignment.id, 2, {}), requiredError);
      const files = mode === 'AUDIO' ? [audio] : mode === 'TEXT' ? [] : [document];
      const result = await service.submitStudentAssignment(assignment.id, 2, { submissionText: mode === 'TEXT' ? 'Answer' : '' }, files);
      assert.equal(result.status, 'SUBMITTED');
      const detail = await service.getStudentAssignment(assignment.id, 2);
      assert.equal(detail.submission.assets.length, files.length);
      if (mode === 'AUDIO') {
        await assert.rejects(service.submitStudentAssignment(assignment.id, 2, {}, [document]), /AUDIO_REQUIRED/);
        await service.submitStudentAssignment(assignment.id, 2, { submissionText: 'Updated' });
        assert.equal((await service.getStudentAssignment(assignment.id, 2)).submission.assets.length, 1);
      }
      await service.grade(assignment.id, 3, { score: 8 }, 1);
      await assert.rejects(service.submitStudentAssignment(assignment.id, 2, { submissionText: 'overwrite' }, files), /GRADED_LOCKED/);
    }
  }
});

test('HTTP upload, ownership, CSRF and parent contact header work end to end', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie = '';
    return async (path, options = {}) => {
      const res = await fetch(base + path, { ...options, redirect: 'manual', headers: { Cookie: cookie, ...options.headers } });
      const updated = res.headers.get('set-cookie');
      if (updated) cookie = updated.split(';')[0];
      return { status: res.status, body: await res.text(), location: res.headers.get('location') };
    };
  }
  const csrf = body => { const match = body.match(/name="_csrf" value="([^"]+)"/); assert.ok(match, 'page exposes CSRF token'); return match[1]; };
  async function login(request, username, password) {
    const page = await request('/login');
    const res = await request('/login', { method: 'POST', body: new URLSearchParams({ username, password, _csrf: csrf(page.body) }) });
    assert.equal(res.status, 302);
  }
  const student = client(), teacher = client(), parent = client();
  await login(student, 'student', 'Student@123');
  await login(teacher, 'teacher', 'Teacher@123');
  await login(parent, 'parent', 'Parent@123');
  const assignment = await service.create({ classId: 2, title: 'HTTP upload', submissionMode: 'MIXED' }, 1);
  await service.publish(assignment.id, 1);
  const path = `/student/assignments/${assignment.id}`;
  let page = await student(path);
  assert.equal(page.status, 200);
  assert.match(page.body, /type="file"/);
  const token = csrf(page.body);
  function upload(type, name, tokenValue = token, count = 1) {
    const body = new FormData();
    body.append('_csrf', tokenValue);
    for (let i = 0; i < count; i++) body.append('attachments', new Blob(['content'], { type }), name);
    return student(`${path}/submit`, { method: 'POST', body });
  }
  assert.equal((await upload('application/pdf', 'answer.pdf', 'wrong')).status, 403);
  assert.equal((await service.getStudentAssignment(assignment.id, 2)).submission.status, 'NOT_STARTED');
  const invalid = await upload('application/x-executable', 'bad.exe');
  assert.equal(invalid.status, 400);
  assert.match(invalid.body, /Định dạng tệp không được hỗ trợ/);
  assert.equal((await upload('application/pdf', 'answer.pdf', token, 4)).status, 400);
  const oversized = new FormData();
  oversized.append('_csrf', token);
  oversized.append('attachments', new Blob([Buffer.alloc(1024 * 1024 + 1)], { type: 'application/pdf' }), 'large.pdf');
  assert.equal((await student(`${path}/submit`, { method: 'POST', body: oversized })).status, 400);
  assert.equal((await upload('video/mp4', 'answer.mp4')).status, 302);
  const asset = (await service.getStudentAssignment(assignment.id, 2)).submission.assets[0];
  assert.equal((await student(`${path}/assets/${asset.id}`)).body, 'content');
  assert.equal((await teacher(`/assignments/${assignment.id}/assets/${asset.id}`)).status, 200);
  assert.equal((await parent(`${path}/assets/${asset.id}`)).status, 403);
  assert.equal((await parent('/teacher/social-links')).status, 403);
  store.students.push({ id: 999, fullName: 'Other student', classIds: [2] });
  store.assignmentSubmissionAssets.push({ id: 999, assignmentId: assignment.id, studentId: 999, content: Buffer.from('private'), sizeBytes: 7 });
  assert.equal((await student(`${path}/assets/999`)).status, 404);
  const teacherDashboard = await teacher('/dashboard');
  assert.match(teacherDashboard.body, /Cấu hình mạng xã hội/);
  assert.match(teacherDashboard.body, /Facebook \/ Messenger \/ Zalo/);
  page = await teacher('/teacher/social-links');
  const links = { _csrf: csrf(page.body), facebookUrl: 'https://facebook.com/teacher', messengerUrl: 'https://m.me/teacher', zaloUrl: 'https://zalo.me/0900000000' };
  assert.equal((await teacher('/teacher/social-links', { method: 'POST', body: new URLSearchParams(links) })).status, 302);
  store.studentScores.push(
    { id: 9901, studentId: 3, title: 'Forgot sheet', score: -1, maxScore: 10, recordedAt: '2026-08-15' },
    { id: 9902, studentId: 3, title: 'Incomplete', score: -2, maxScore: 10, recordedAt: '2026-08-15' },
  );
  const progress = await parent('/parent/progress');
  assert.match(progress.body, /Quên phiếu bài/);
  assert.match(progress.body, /Chưa hoàn thành/);
  for (const route of ['/parent', '/parent/progress', '/parent/reports', '/parent/notifications', '/parent/tuition', '/account/password']) {
    const result = await parent(route);
    assert.equal(result.status, 200, route);
    for (const url of [links.facebookUrl, links.messengerUrl, links.zaloUrl]) assert.ok(result.body.includes(`href="${url}"`), `${route} includes ${url}`);
  }
  for (const route of ['/student', '/student/progress', '/student/materials', '/student/assignments', '/student/exams', '/account/password', path]) {
    const result = await student(route);
    assert.equal(result.status, 200, route);
    for (const url of [links.facebookUrl, links.messengerUrl, links.zaloUrl]) assert.ok(result.body.includes(`href="${url}"`), `${route} includes ${url}`);
    assert.ok(result.body.indexOf('parent-social-links') < result.body.indexOf('dropdown account-menu'), 'contacts precede the account menu');
    assert.match(result.body, /class="ms-2 dropdown account-menu"/);
  }
  const studentChatPage = await student('/student');
  assert.match(studentChatPage.body, /href="zalo:\/\/conversation\?phone=0900000000"/);
  assert.match(studentChatPage.body, /data-zalo-fallback/);
  assert.match((await parent('/parent')).body, /href="zalo:\/\/conversation\?phone=0900000000"/);
  const formPage = await teacher('/teacher/social-links');
  const savedToken = csrf(formPage.body);
  const badSave = await teacher('/teacher/social-links', {
    method: 'POST', body: new URLSearchParams({ ...links, _csrf: savedToken, facebookUrl: 'https://evil.example' }),
  });
  assert.equal(badSave.status, 400);
  assert.ok((await parent('/parent')).body.includes(`href="${links.facebookUrl}"`));
  store.classes.find(item => item.id === 3).teacherId = 991;
  store.teacherSocialLinks.push({ teacherId: 991, facebookUrl: 'https://facebook.com/otherteacher' });
  const otherChild = await parent('/account/password?childId=5');
  assert.ok(otherChild.body.includes('href="https://facebook.com/otherteacher"'));
  assert.ok(!otherChild.body.includes(`href="${links.facebookUrl}"`));
  const invalidChild = await parent('/account/password?childId=999');
  assert.ok(invalidChild.body.includes(`href="${links.facebookUrl}"`));
  assert.equal((await teacher('/teacher/social-links', {
    method: 'POST', body: new URLSearchParams({ _csrf: savedToken, facebookUrl: '', messengerUrl: '', zaloUrl: '' }),
  })).status, 302);
  const cleared = await parent('/parent');
  for (const url of [links.facebookUrl, links.messengerUrl, links.zaloUrl]) assert.ok(!cleared.body.includes(`href="${url}"`));
  const clearedStudent = await student('/student');
  for (const url of [links.facebookUrl, links.messengerUrl, links.zaloUrl]) assert.ok(!clearedStudent.body.includes(`href="${url}"`));
});


test('submission rolls back when grading wins the database lock', async () => {
  const env = require('../src/config/env');
  const pool = require('../src/config/db');
  const repository = require('../src/modules/assignments/assignment.repository');
  const originalQuery = pool.query, originalConnect = pool.connect;
  const commands = [];
  pool.query = async () => ({ rows: [{ id: 77, classId: 2, status: 'PUBLISHED', studentId: 3, submissionStatus: 'NOT_STARTED', submissionMode: 'TEXT', assets: [] }] });
  pool.connect = async () => ({
    query: async text => { commands.push(text); return { rows: text.startsWith('SELECT status') ? [{ status: 'GRADED' }] : [] }; },
    release: () => commands.push('RELEASE'),
  });
  env.demo.enabled = false;
  try {
    await assert.rejects(repository.submitStudentAssignment(77, 2, { submissionText: 'Answer' }), /GRADED_LOCKED/);
    assert.ok(commands.some(command => command.includes('FOR UPDATE')));
    assert.deepEqual(commands.slice(-2), ['ROLLBACK', 'RELEASE']);
    assert.ok(!commands.some(command => command.includes('INSERT')));
  } finally {
    env.demo.enabled = true;
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});
