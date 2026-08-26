const express = require('express');
const controller = require('./assignment.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/assignments', requireRole('TEACHER', 'ADMIN'), controller.index);
web.get('/assignments/new', requireRole('TEACHER', 'ADMIN'), controller.newForm);
web.post('/assignments', requireRole('TEACHER', 'ADMIN'), controller.create);
web.get('/assignments/:id/edit', requireRole('TEACHER', 'ADMIN'), controller.editForm);
web.post('/assignments/:id/update', requireRole('TEACHER', 'ADMIN'), controller.update);
web.get('/assignments/:id', requireRole('TEACHER', 'ADMIN'), controller.detail);
web.post('/assignments/:id/publish', requireRole('TEACHER', 'ADMIN'), controller.publish);
web.post('/assignments/:id/submissions/:studentId/grade', requireRole('TEACHER', 'ADMIN'), controller.grade);

web.get('/student/assignments/:id', requireRole('STUDENT'), controller.studentDetail);
web.post('/student/assignments/:id/submit', requireRole('STUDENT'), controller.studentSubmit);

const api = express.Router();
api.get('/assignments', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
