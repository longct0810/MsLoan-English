const express = require('express');
const controller = require('./student.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/students', requireRole('TEACHER', 'ADMIN'), controller.index);
web.get('/students/new', requireRole('TEACHER', 'ADMIN'), controller.newForm);
web.get('/students/:id', requireRole('TEACHER', 'ADMIN'), controller.detail);
web.post('/students', requireRole('TEACHER', 'ADMIN'), controller.create);
web.get('/students/:id/edit', requireRole('TEACHER', 'ADMIN'), controller.editForm);
web.post('/students/:id', requireRole('TEACHER', 'ADMIN'), controller.update);
web.post('/students/:id/delete', requireRole('TEACHER', 'ADMIN'), controller.remove);

const api = express.Router();
api.get('/students', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
