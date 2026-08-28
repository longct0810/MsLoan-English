const service = require('./student.service');
const env = require('../../config/env');

async function index(req, res, next) {
  try {
    const classId = req.query.classId || '';
    const data = await service.getStudentPageData({ classId }, req.session.user.id, req.session.user.role === 'ADMIN');
    res.render('students/index', {
      title: 'Học viên', ...data, selectedClassId: classId,
      message: req.query.created
        ? (env.demo.enabled ? 'Đã tạo học viên trong DEMO MODE (chỉ lưu bộ nhớ, chưa ghi PostgreSQL/Neon).' : 'Đã tạo học viên và tài khoản phụ huynh vào PostgreSQL/Neon.')
        : req.query.updated
          ? (env.demo.enabled ? 'Đã cập nhật học viên trong DEMO MODE (chỉ lưu bộ nhớ).' : 'Đã cập nhật học viên trong PostgreSQL/Neon.')
          : req.query.deleted
            ? (env.demo.enabled ? 'Đã xóa học viên trong DEMO MODE (chỉ lưu bộ nhớ).' : 'Đã xóa học viên khỏi danh sách sử dụng.')
            : '',
    });
  } catch (error) { next(error); }
}

async function newForm(req, res, next) {
  try {
    const { classes } = await service.getFormData(null, req.session.user.id, req.session.user.role === 'ADMIN');
    res.render('students/form', { title: 'Thêm học viên', student: null, classes, formData: { classIds: req.query.classId ? [req.query.classId] : [] }, errors: [] });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const result = await service.createStudent(req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    if (result.errors) {
      const { classes } = await service.getFormData(null, req.session.user.id, req.session.user.role === 'ADMIN');
      return res.status(400).render('students/form', { title: 'Thêm học viên', student: null, classes, formData: result.data, errors: result.errors });
    }
    res.redirect('/students?created=1');
  } catch (error) { next(error); }
}

async function editForm(req, res, next) {
  try {
    const { student, classes } = await service.getFormData(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!student) return res.status(404).render('errors/404', { title: 'Không tìm thấy học viên' });
    res.render('students/form', { title: 'Chỉnh sửa học viên', student, classes, formData: student, errors: [] });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    const result = await service.updateStudent(req.params.id, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    if (result.errors || !result.student) {
      const { classes } = await service.getFormData(null, req.session.user.id, req.session.user.role === 'ADMIN');
      return res.status(result.student === null ? 404 : 400).render('students/form', { title: 'Chỉnh sửa học viên', student: { id: req.params.id }, classes, formData: result.data, errors: result.errors || ['Không tìm thấy học viên.'] });
    }
    res.redirect('/students?updated=1');
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const ok = await service.deleteStudent(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!ok) return res.status(404).render('errors/404', { title: 'Không tìm thấy học viên' });
    res.redirect('/students?deleted=1');
  } catch (error) { next(error); }
}

async function apiList(req, res, next) {
  try { res.json({ data: await service.getStudents({ classId: req.query.classId }, req.session.user.id, req.session.user.role === 'ADMIN') }); }
  catch (error) { next(error); }
}

module.exports = { index, newForm, create, editForm, update, remove, apiList };
