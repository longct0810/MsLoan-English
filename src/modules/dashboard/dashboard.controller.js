const service = require('./dashboard.service');

async function index(req, res, next) {
  try {
    const dashboard = await service.getDashboard(req.session.user.id, req.session.user.role === 'ADMIN');
    res.render('dashboard/index', { title: 'Tổng quan', dashboard });
  } catch (error) {
    next(error);
  }
}

module.exports = { index };
