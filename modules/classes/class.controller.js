const service = require('./class.service');

async function index(req, res, next) {
  try {
    const classes = await service.getClasses();
    res.render('classes/index', { title: 'Lớp học', classes });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const classItem = await service.getClassDetail(req.params.id);
    if (!classItem) return res.status(404).render('errors/404', { title: 'Không tìm thấy lớp' });
    res.render('classes/detail', { title: classItem.name, classItem });
  } catch (error) {
    next(error);
  }
}

async function apiList(req, res, next) {
  try {
    res.json({ data: await service.getClasses() });
  } catch (error) {
    next(error);
  }
}

async function apiStudents(req, res, next) {
  try {
    const classItem = await service.getClassDetail(req.params.id);
    if (!classItem) return res.status(404).json({ message: 'Class not found' });
    res.json({ data: classItem.students });
  } catch (error) {
    next(error);
  }
}

module.exports = { index, detail, apiList, apiStudents };
