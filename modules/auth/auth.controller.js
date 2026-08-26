const authService = require('./auth.service');
const { getRoleHome } = require('../../shared/role-home');

function showLogin(req, res) {
  if (req.session.user) return res.redirect(getRoleHome(req.session.user.role));
  res.render('auth/login', { title: 'Đăng nhập', error: null });
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const user = await authService.login(email, password);

    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Đăng nhập',
        error: 'Email hoặc mật khẩu không đúng.',
      });
    }

    req.session.user = user;
    res.redirect(getRoleHome(user.role));
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = { showLogin, login, logout };
