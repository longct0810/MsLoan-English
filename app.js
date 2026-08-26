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
app.set('trust proxy', env.app.trustProxy);
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: true, limit: env.app.urlencodedLimit }));
app.use(express.json({ limit: env.app.jsonLimit }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionOptions = {
  name: env.session.cookieName,
  secret: env.session.secret,
  resave: env.session.resave,
  saveUninitialized: env.session.saveUninitialized,
  cookie: {
    httpOnly: env.session.httpOnly,
    sameSite: env.session.sameSite,
    secure: env.session.secure,
    maxAge: env.session.maxAgeMs,
  },
};

if (!env.demo.enabled) {
  const PgSession = pgSessionFactory(session);
  sessionOptions.store = new PgSession({
    pool,
    tableName: env.session.tableName,
    createTableIfMissing: env.session.createTableIfMissing,
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
app.use(env.app.apiPrefix, classRoutes.api);
app.use(env.app.apiPrefix, studentRoutes.api);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Không tìm thấy trang' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith(`${env.app.apiPrefix}/`) || req.path === env.app.apiPrefix) {
    return res.status(500).json({ message: 'Internal server error' });
  }
  res.status(500).render('errors/500', {
    title: 'Có lỗi xảy ra',
    error: env.app.nodeEnv === 'development' ? err : null,
  });
});

module.exports = app;
