const crypto = require('crypto');

function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function sameOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin === `${req.protocol}://${req.get('host')}`;
  const referer = req.get('referer');
  if (referer) {
    try { return new URL(referer).origin === `${req.protocol}://${req.get('host')}`; }
    catch { return false; }
  }
  return true;
}

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || sameOrigin(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ message: 'Cross-site request blocked' });
  return res.status(403).render('errors/403', { title: 'Yêu cầu không hợp lệ' });
}

function requireCsrfToken(req, res, next) {
  const contentType = req.get('content-type') || '';
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || contentType.startsWith('multipart/form-data')) return next();
  const supplied = req.get('x-csrf-token') || req.body?._csrf;
  if (supplied && supplied === req.session.csrfToken) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ message: 'CSRF token invalid' });
  return res.status(403).render('errors/403', { title: 'Yêu cầu không hợp lệ' });
}

module.exports = { ensureCsrfToken, requireSameOrigin, requireCsrfToken };