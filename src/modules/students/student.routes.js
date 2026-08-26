const express = require('express');
const controller = require('./student.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');

const web = express.Router();
web.get('/students', requireRole('TEACHER', 'ADMIN'), controller.index);

const api = express.Router();
api.get('/students', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
