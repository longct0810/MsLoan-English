const express = require('express');
const controller = require('./lesson.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/lessons', requireRole('TEACHER', 'ADMIN'), controller.index);
web.get('/lessons/new', requireRole('TEACHER', 'ADMIN'), controller.newForm);
web.post('/lessons', requireRole('TEACHER', 'ADMIN'), controller.create);
web.get('/lessons/:id/edit', requireRole('TEACHER', 'ADMIN'), controller.editForm);
web.post('/lessons/:id/update', requireRole('TEACHER', 'ADMIN'), controller.update);
web.get('/lessons/:id', requireRole('TEACHER', 'ADMIN'), controller.detail);
web.post('/lessons/:id/publish', requireRole('TEACHER', 'ADMIN'), controller.publish);
web.post('/lessons/:id/materials', requireRole('TEACHER', 'ADMIN'), controller.addMaterial);

const api = express.Router();
api.get('/lessons', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
