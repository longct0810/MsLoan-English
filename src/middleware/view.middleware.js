const env = require('../config/env');

function injectViewData(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentPath = req.path;
  res.locals.appName = env.app.name;
  res.locals.appShortName = env.app.shortName;
  res.locals.appVersion = env.app.version;
  res.locals.bootstrapCssUrl = env.assets.bootstrapCssUrl;
  res.locals.bootstrapJsUrl = env.assets.bootstrapJsUrl;
  res.locals.demoMode = env.demo.enabled;
  res.locals.showDemoAccounts = env.demo.enabled && env.demo.showAccountsOnLogin;
  res.locals.demoAccounts = env.demo;
  res.locals.examConfig = env.exam;
  res.locals.questionConfig = env.question;
  res.locals.assignmentConfig = env.assignment;
  next();
}

module.exports = injectViewData;
