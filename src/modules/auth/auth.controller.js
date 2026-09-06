const authService = require('./auth.service');
const { getRoleHome } = require('../../shared/role-home');

function showLogin(req, res) {
  if (req.session.user) return res.redirect(getRoleHome(req.session.user.role));
  res.render('auth/login', { title: 'Đăng nhập', error: null });
}

async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = await authService.login(username, password);

    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Đăng nhập',
        error: 'Tên tài khoản hoặc mật khẩu không đúng.',
      });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = user;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.redirect(getRoleHome(user.role));
      });
    });
  } catch (error) {
    next(error);
  }
}

function passwordErrorMessage(error) {
  const messages = {
    CURRENT_PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu hiện tại.',
    NEW_PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu mới.',
    PASSWORD_TOO_SHORT: `Mật khẩu mới phải có ít nhất ${authService.MIN_PASSWORD_LENGTH} ký tự.`,
    PASSWORD_TOO_LONG: `Mật khẩu mới không được vượt quá ${authService.MAX_PASSWORD_LENGTH} ký tự.`,
    PASSWORD_CONFIRM_MISMATCH: 'Xác nhận mật khẩu mới không khớp.',
    PASSWORD_UNCHANGED: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    CURRENT_PASSWORD_INVALID: 'Mật khẩu hiện tại không đúng.',
    USER_NOT_FOUND: 'Tài khoản không còn hoạt động hoặc không tồn tại.',
  };
  return messages[error.message] || null;
}

function showChangePassword(req, res) {
  res.render('auth/change-password', {
    title: 'Đổi mật khẩu',
    error: null,
    success: req.query.changed === '1' ? 'Đổi mật khẩu thành công.' : null,
    minPasswordLength: authService.MIN_PASSWORD_LENGTH,
    maxPasswordLength: authService.MAX_PASSWORD_LENGTH,
  });
}

async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    await authService.changePassword(
      req.session.user.id,
      currentPassword,
      newPassword,
      confirmPassword,
    );

    const currentUser = { ...req.session.user };
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = currentUser;
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.redirect('/account/password?changed=1');
      });
    });
  } catch (error) {
    const message = passwordErrorMessage(error);
    if (!message) return next(error);

    const status = error.message === 'CURRENT_PASSWORD_INVALID' ? 401 : 400;
    return res.status(status).render('auth/change-password', {
      title: 'Đổi mật khẩu',
      error: message,
      success: null,
      minPasswordLength: authService.MIN_PASSWORD_LENGTH,
      maxPasswordLength: authService.MAX_PASSWORD_LENGTH,
    });
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

module.exports = {
  showLogin,
  login,
  showChangePassword,
  changePassword,
  logout,
};
