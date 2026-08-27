const env = require('../../config/env');
const service = require('./class.service');

async function index(req, res, next) {
  try {
    const classes = await service.getClasses(req.session.user.id, req.session.user.role === 'ADMIN');
    res.render('classes/index', {
      title: 'Lớp học', classes,
      message: req.query.created ? 'Đã tạo lớp học.' : req.query.updated ? 'Đã cập nhật lớp học.' : req.query.deleted ? 'Đã xóa lớp khỏi danh sách sử dụng.' : '',
    });
  } catch (error) { next(error); }
}
async function newForm(req, res, next) {
  try {
    const { grades } = await service.getFormData();
    res.render('classes/form', { title: 'Thêm lớp', classItem: null, grades, formData: { schoolYear: env.academic.defaultSchoolYear, status: 'ACTIVE' }, errors: [] });
  } catch (error) { next(error); }
}
async function create(req, res, next) {
  try {
    const result = await service.createClass(req.body, req.session.user.id);
    if (result.errors) {
      const grades = await service.getGrades();
      return res.status(400).render('classes/form', { title: 'Thêm lớp', classItem: null, grades, formData: result.data, errors: result.errors });
    }
    res.redirect('/classes?created=1');
  } catch (error) { next(error); }
}
async function editForm(req, res, next) {
  try {
    const { classItem, grades } = await service.getFormData(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!classItem) return res.status(404).render('errors/404', { title: 'Không tìm thấy lớp' });
    res.render('classes/form', { title: 'Chỉnh sửa lớp', classItem, grades, formData: classItem, errors: [] });
  } catch (error) { next(error); }
}
async function update(req, res, next) {
  try {
    const result = await service.updateClass(req.params.id, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    if (result.errors || !result.classItem) {
      const grades = await service.getGrades();
      return res.status(result.classItem === null ? 404 : 400).render('classes/form', { title: 'Chỉnh sửa lớp', classItem: { id: req.params.id }, grades, formData: result.data, errors: result.errors || ['Không tìm thấy lớp.'] });
    }
    res.redirect('/classes?updated=1');
  } catch (error) { next(error); }
}
async function remove(req, res, next) {
  try {
    const ok = await service.deleteClass(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!ok) return res.status(404).render('errors/404', { title: 'Không tìm thấy lớp' });
    res.redirect('/classes?deleted=1');
  } catch (error) { next(error); }
}
async function detail(req, res, next) {
  try {
    const classItem = await service.getClassDetail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!classItem) return res.status(404).render('errors/404', { title: 'Không tìm thấy lớp' });
    res.render('classes/detail', { title: classItem.name, classItem });
  } catch (error) { next(error); }
}
async function apiList(req, res, next) { try { res.json({ data: await service.getClasses(req.session.user.id, req.session.user.role === 'ADMIN') }); } catch (error) { next(error); } }
async function apiStudents(req, res, next) {
  try { const classItem = await service.getClassDetail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN'); if (!classItem) return res.status(404).json({ message: 'Class not found' }); res.json({ data: classItem.students }); }
  catch (error) { next(error); }
}
module.exports = { index, newForm, create, editForm, update, remove, detail, apiList, apiStudents };
