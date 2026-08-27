const express = require('express');
const controller = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/login', controller.showLogin);
router.post('/login', controller.login);
router.get('/account/password', requireAuth, controller.showChangePassword);
router.post('/account/password', requireAuth, controller.changePassword);
router.post('/logout', controller.logout);

module.exports = router;
