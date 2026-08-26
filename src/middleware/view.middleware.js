function injectViewData(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  res.locals.currentPath = req.path;
  res.locals.appName = 'English Classroom';
  next();
}

module.exports = injectViewData;
