const express = require('express');
const controller = require('./report.controller');
const { requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/reports', requireRole('TEACHER', 'ADMIN'), controller.index);
router.get('/reports.csv', requireRole('TEACHER', 'ADMIN'), controller.csv);
router.get('/reports.xlsx', requireRole('TEACHER', 'ADMIN'), controller.xlsx);
router.get('/reports/students/:studentId', requireRole('TEACHER', 'ADMIN'), controller.studentDetail);

module.exports = router;
