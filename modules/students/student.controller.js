const service = require('./student.service');

async function index(req, res, next) {
  try {
    const classId = req.query.classId || '';
    const data = await service.getStudentPageData({ classId });
    res.render('students/index', {
      title: 'Học viên',
      ...data,
      selectedClassId: classId,
    });
  } catch (error) {
    next(error);
  }
}

async function apiList(req, res, next) {
  try {
    const students = await service.getStudents({ classId: req.query.classId });
    res.json({ data: students });
  } catch (error) {
    next(error);
  }
}

module.exports = { index, apiList };
