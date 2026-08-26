const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const env = require('./config/env');
const pool = require('./config/db');
const injectViewData = require('./middleware/view.middleware');
const { getRoleHome } = require('./shared/role-home');
const authRoutes = require('./modules/auth/auth.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const classRoutes = require('./modules/classes/class.routes');
const studentRoutes = require('./modules/students/student.routes');
const portalRoutes = require('./modules/portal/portal.routes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionOptions = {
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
};

if (!env.demoMode) {
  const PgSession = pgSessionFactory(session);
  sessionOptions.store = new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  });
}

app.use(session(sessionOptions));
app.use(injectViewData);

app.get('/', (req, res) => {
  res.redirect(req.session.user ? getRoleHome(req.session.user.role) : '/login');
});
app.get('/home', (req, res) => {
  res.redirect(req.session.user ? getRoleHome(req.session.user.role) : '/login');
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(classRoutes.web);
app.use(studentRoutes.web);
app.use(portalRoutes);
app.use('/api/v1', classRoutes.api);
app.use('/api/v1', studentRoutes.api);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Không tìm thấy trang' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ message: 'Internal server error' });
  }
  res.status(500).render('errors/500', {
    title: 'Có lỗi xảy ra',
    error: env.nodeEnv === 'development' ? err : null,
  });
});

module.exports = app;
