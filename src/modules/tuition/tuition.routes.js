const express = require('express');
const controller = require('./tuition.controller');
const { requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/teacher/tuition', requireRole('TEACHER'), controller.index);
router.post('/teacher/tuition/settings', requireRole('TEACHER'), controller.saveSettings);
router.post('/teacher/tuition/plans/:classId', requireRole('TEACHER'), controller.savePlan);
router.post('/teacher/tuition/cycles', requireRole('TEACHER'), controller.createCycle);
router.get('/teacher/tuition/cycles/:id', requireRole('TEACHER'), controller.cycleDetail);
router.post('/teacher/tuition/cycles/:id/send', requireRole('TEACHER'), controller.sendCycle);
router.get('/teacher/tuition/invoices/:id', requireRole('TEACHER'), controller.invoiceDetail);
router.post('/teacher/tuition/invoices/:id/adjust', requireRole('TEACHER'), controller.updateInvoice);
router.post('/teacher/tuition/invoices/:id/payments', requireRole('TEACHER'), controller.recordPayment);

router.get('/parent/tuition', requireRole('PARENT'), controller.parentIndex);
router.get('/parent/tuition/:id', requireRole('PARENT'), controller.parentInvoice);

module.exports = router;
