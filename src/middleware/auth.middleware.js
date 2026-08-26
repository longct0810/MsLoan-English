function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireApiAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('errors/403', {
        title: 'Không có quyền truy cập',
      });
    }
    next();
  };
}

function requireApiRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireApiAuth, requireRole, requireApiRole };
