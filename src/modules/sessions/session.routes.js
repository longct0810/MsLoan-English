const express = require('express');
const controller = require('./session.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/sessions', requireRole('TEACHER', 'ADMIN'), controller.index);
web.get('/sessions/new', requireRole('TEACHER', 'ADMIN'), controller.newForm);
web.post('/sessions', requireRole('TEACHER', 'ADMIN'), controller.create);
web.get('/sessions/:id', requireRole('TEACHER', 'ADMIN'), controller.detail);
web.post('/sessions/:id/attendance', requireRole('TEACHER', 'ADMIN'), controller.saveAttendance);
web.post('/sessions/:id/notes', requireRole('TEACHER', 'ADMIN'), controller.addNote);
web.post('/sessions/:id/complete', requireRole('TEACHER', 'ADMIN'), controller.complete);

const api = express.Router();
api.get('/sessions', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
