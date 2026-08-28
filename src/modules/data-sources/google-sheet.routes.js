'use strict';

const express = require('express');

function createGoogleSheetRoutes({ controller, requireAuth, requireTeacher }) {
  const router = express.Router();

  if (typeof requireAuth !== 'function' || typeof requireTeacher !== 'function') {
    throw new Error('Google Sheets routes phải được mount với requireAuth và requireTeacher.');
  }
  router.use(requireAuth);
  router.use(requireTeacher);

  router.get('/', controller.index);
  router.post('/', controller.create);
  router.get('/:id', controller.detail);
  router.post('/:id/sync', controller.syncNow);
  router.post('/:id/student-links', controller.linkStudent);

  return router;
}

module.exports = { createGoogleSheetRoutes };
