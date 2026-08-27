const multer = require('multer');
const env = require('../../config/env');
const { requireParsedCsrfToken } = require('../../middleware/security.middleware');
const express = require('express');
const controller = require('./assignment.controller');
const { requireRole, requireApiRole } = require('../../middleware/auth.middleware');
const allowedMime = new Set(['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','audio/mpeg','audio/wav','audio/webm','audio/mp4','audio/x-m4a']);
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: env.assignment.uploadMaxFileMb*1024*1024, files: env.assignment.uploadMaxFiles }, fileFilter:(req,file,cb)=>cb(allowedMime.has(file.mimetype)?null:new Error('INVALID_FILE_TYPE'),allowedMime.has(file.mimetype)) });

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
web.post('/student/assignments/:id/submit', requireRole('STUDENT'), upload.array('attachments', env.assignment.uploadMaxFiles), requireParsedCsrfToken, controller.studentSubmit);
web.get('/student/assignments/:id/assets/:assetId', requireRole('STUDENT'), controller.asset);
web.get('/assignments/:id/assets/:assetId', requireRole('TEACHER','ADMIN'), controller.asset);

const api = express.Router();
api.get('/assignments', requireApiRole('TEACHER', 'ADMIN'), controller.apiList);

module.exports = { web, api };
