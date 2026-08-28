'use strict';

const { createGoogleSheetRepository } = require('./google-sheet.repository');
const { createGoogleSheetService } = require('./google-sheet.service');
const { createGoogleSheetController } = require('./google-sheet.controller');
const { createGoogleSheetRoutes } = require('./google-sheet.routes');

function createGoogleSheetModule({ pool, logger, requireAuth, requireTeacher }) {
  const repository = createGoogleSheetRepository(pool);
  const service = createGoogleSheetService({ pool, repository, logger });
  const controller = createGoogleSheetController({ repository, service });
  const router = createGoogleSheetRoutes({ controller, requireAuth, requireTeacher });
  return { repository, service, controller, router };
}

module.exports = { createGoogleSheetModule };
