'use strict';

const express = require('express');
const controller = require('./teacher-social.controller');
const { requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/teacher/social-links', requireRole('TEACHER'), controller.index);
router.post('/teacher/social-links', requireRole('TEACHER'), controller.save);

module.exports = router;