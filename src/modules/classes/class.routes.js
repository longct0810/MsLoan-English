const express = require('express');
const controller = require('./class.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/classes', requireRole('TEACHER', 'ADMIN'), controller.index);
web.get('/classes/:id', requireRole('TEACHER', 'ADMIN'), controller.detail);

const api = express.Router();
api.get('/classes', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);
api.get('/classes/:id/students', requireApiRole('TEACHER', 'ADMIN'), controller.apiStudents);

module.exports = { web, api };
