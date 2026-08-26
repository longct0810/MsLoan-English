const express = require('express');
const controller = require('./dashboard.controller');
const { requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/dashboard', requireRole('TEACHER', 'ADMIN'), controller.index);

module.exports = router;
