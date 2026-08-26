const express = require('express');
const controller = require('./auth.controller');

const router = express.Router();
router.get('/login', controller.showLogin);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

module.exports = router;
