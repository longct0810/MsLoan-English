'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { prioritizeAssignments } = require('../src/shared/assignment-priority');
const { normalizeSocialLink } = require('../src/shared/social-links');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('unsubmitted and late assignments appear before completed work', () => {
  const ordered = prioritizeAssignments([
    { id: 1, dueAt: '2026-06-01', submission: { status: 'GRADED' } },
    { id: 2, dueAt: '2026-06-03', submission: { status: 'NOT_STARTED' } },
    { id: 3, dueAt: '2026-06-02', submission: { status: 'LATE' } },
    { id: 4, dueAt: '2026-06-01', submission: { status: 'SUBMITTED' } },
  ]);
  assert.deepEqual(ordered.map((item) => item.id), [3, 2, 1, 4]);
});

test('social contact URLs are normalized and restricted to their platform', () => {
  assert.equal(normalizeSocialLink('facebook.com/teacher', 'facebookUrl'), 'https://facebook.com/teacher');
  assert.equal(normalizeSocialLink('https://m.me/teacher', 'messengerUrl'), 'https://m.me/teacher');
  assert.equal(normalizeSocialLink('https://zalo.me/0900000000', 'zaloUrl'), 'https://zalo.me/0900000000');
  assert.equal(normalizeSocialLink('', 'zaloUrl'), '');
  assert.throws(() => normalizeSocialLink('https://evil.example/fb.com', 'facebookUrl'), /INVALID_SOCIAL_LINK/);
  assert.throws(() => normalizeSocialLink('http://facebook.com/teacher', 'facebookUrl'), /INVALID_SOCIAL_LINK/);
});

test('parent contact and score views compile and expose sentinel labels', () => {
  for (const view of [
    'src/views/partials/app-start.ejs',
    'src/views/teacher/social-links.ejs',
    'src/views/parent-portal/dashboard.ejs',
    'src/views/parent-portal/progress.ejs',
    'src/views/parent-portal/reports.ejs',
    'src/views/parent-portal/tuition.ejs',
    'src/views/parent-portal/tuition-invoice.ejs',
    'src/views/student-portal/progress.ejs',
    'src/views/student-portal/dashboard.ejs',
  ]) ejs.compile(read(view));

  const header = read('src/views/partials/app-start.ejs');
  assert.match(header, /parentSocialLinks\.facebookUrl/);
  assert.match(header, /parentSocialLinks\.messengerUrl/);
  assert.match(header, /parentSocialLinks\.zaloUrl/);
  assert.match(header, /tuition\.socialLinks/);
  assert.match(header, /invoice\.socialLinks/);
  assert.match(read('src/views/parent-portal/reports.ejs'), /Điểm ghi nhận trong tháng/);
  assert.match(read('src/modules/portal/portal.service.js'), /formatScore\(item\.score, item\.maxScore\)/);
});

test('assignment modes keep attachment support and v0.26.0 migration filters averages', () => {
  const form = read('src/views/assignments/new.ejs');
  const submission = read('src/views/student-portal/assignment-detail.ejs');
  const uploadRoutes = read('src/modules/assignments/assignment.routes.js');
  const migration = read('sql/upgrade_v0.26.0.sql');
  for (const mode of ['TEXT', 'FILE', 'AUDIO', 'MIXED']) assert.ok(form.includes(`'${mode}'`));
  assert.match(submission, /enctype="multipart\/form-data"/);
  assert.match(uploadRoutes, /upload\.array\('attachments'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS teacher_social_links/);
  assert.match(migration, /FILTER \(WHERE ss\.score > 0\)/);
});