const crypto = require('crypto');
const env = require('../config/env');

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

function renderForbidden(req, res, message) {
  return res.status(403).render('errors/403', {
    title: 'Yêu cầu không hợp lệ',
    forbiddenMessage: message,
    appName: env.app.name,
    appShortName: env.app.shortName,
    appVersion: env.app.version,
    csrfToken: req.session?.csrfToken || '',
    bootstrapCssUrl: env.assets.bootstrapCssUrl,
    bootstrapJsUrl: env.assets.bootstrapJsUrl,
  });
}

function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || sameOrigin(req)) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ message: 'Cross-site request blocked' });
  return renderForbidden(req, res, 'Yêu cầu bị chặn vì nguồn gửi không khớp với địa chỉ ứng dụng. Hãy mở lại trang bằng địa chỉ chính thức.');
}

function csrfTokenMatches(req) {
  const supplied = req.get('x-csrf-token') || req.body?._csrf;
  return Boolean(supplied && req.session?.csrfToken && supplied === req.session.csrfToken);
}

function rejectCsrf(req, res) {
  if (req.path.startsWith('/api/')) return res.status(403).json({ message: 'CSRF token invalid' });
  if (req.method === 'POST' && req.path === '/login') {
    return res.status(419).render('auth/login', {
      title: 'Đăng nhập',
      error: 'Phiên đăng nhập của biểu mẫu đã hết hạn. Vui lòng nhập lại tài khoản và mật khẩu.',
      appName: env.app.name,
      appShortName: env.app.shortName,
      appVersion: env.app.version,
      demoMode: env.demo.enabled,
      showDemoAccounts: false,
      csrfToken: req.session.csrfToken,
      bootstrapCssUrl: env.assets.bootstrapCssUrl,
      bootstrapJsUrl: env.assets.bootstrapJsUrl,
    });
  }
  return renderForbidden(req, res, 'Biểu mẫu đã hết hạn hoặc mã bảo mật không hợp lệ. Hãy tải lại trang và thử lại.');
}

function requireCsrfToken(req, res, next) {
  const contentType = req.get('content-type') || '';
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // multipart/form-data is parsed later by Multer. Such routes must call
  // requireParsedCsrfToken immediately after the upload middleware.
  if (contentType.startsWith('multipart/form-data')) return next();
  if (csrfTokenMatches(req)) return next();
  return rejectCsrf(req, res);
}

function requireParsedCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || csrfTokenMatches(req)) return next();
  return rejectCsrf(req, res);
}

module.exports = {
  ensureCsrfToken,
  requireSameOrigin,
  requireCsrfToken,
  requireParsedCsrfToken,
};
