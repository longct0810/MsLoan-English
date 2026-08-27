const express = require('express');
const controller = require('./portal.controller');
const { requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/student', requireRole('STUDENT'), controller.studentDashboard);
router.get('/student/assignments', requireRole('STUDENT'), controller.studentAssignments);
router.get('/student/progress', requireRole('STUDENT'), controller.studentProgress);
router.get('/student/materials', requireRole('STUDENT'), controller.studentMaterials);

router.get('/parent', requireRole('PARENT'), controller.parentDashboard);
router.get('/parent/progress', requireRole('PARENT'), controller.parentProgress);
router.get('/parent/reports', requireRole('PARENT'), controller.parentReports);
router.get('/parent/reports.csv', requireRole('PARENT'), controller.parentReportCsv);
router.get('/parent/notifications', requireRole('PARENT'), controller.parentNotifications);
router.post('/parent/notifications/read', requireRole('PARENT'), controller.markParentNotificationRead);

module.exports = router;
