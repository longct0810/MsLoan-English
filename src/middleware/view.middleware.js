const env = require('../config/env');
const { formatScore } = require('../shared/score-display');

async function injectViewData(req, res, next) {
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
  res.locals.formatScore = formatScore;
  res.locals.parentHeaderSocialLinks = {};
  res.locals.studentHeaderSocialLinks = {};
  // Account pages share the parent header but have no portal snapshot.
  if (req.session?.user?.role === 'PARENT' && req.path === '/account/password') {
    try {
      const repo = require('../modules/portal/portal.repository');
      const children = await repo.getChildrenByParentUserId(req.session.user.id);
      const selected = children.find(child => Number(child.id) === Number(req.query?.childId)) || children[0];
      if (selected) res.locals.parentHeaderSocialLinks = await repo.getParentSocialLinks(selected.id);
    } catch (error) { return next(error); }
  }
  if (req.session?.user?.role === 'STUDENT') {
    try {
      const repo = require('../modules/portal/portal.repository');
      const studentId = await repo.getStudentIdByUserId(req.session.user.id);
      if (studentId) res.locals.studentHeaderSocialLinks = await repo.getParentSocialLinks(studentId);
    } catch (error) { return next(error); }
  }
  next();
}

module.exports = injectViewData;
