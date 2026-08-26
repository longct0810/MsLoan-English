const service = require('./dashboard.service');

async function index(req, res, next) {
  try {
    const dashboard = await service.getDashboard();
    res.render('dashboard/index', { title: 'Tổng quan', dashboard });
  } catch (error) {
    next(error);
  }
}

module.exports = { index };
