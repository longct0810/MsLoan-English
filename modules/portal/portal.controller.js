const service = require('./portal.service');

async function studentDashboard(req, res, next) {
  try {
    const portal = await service.getStudentPortal(req.session.user.id);
    if (!portal) return res.status(404).render('errors/404', { title: 'Không tìm thấy hồ sơ học sinh' });
    res.render('student-portal/dashboard', { title: 'Trang học sinh', portal });
  } catch (error) { next(error); }
}

async function studentAssignments(req, res, next) {
  try {
    const portal = await service.getStudentPortal(req.session.user.id);
    res.render('student-portal/assignments', { title: 'Bài tập của tôi', portal });
  } catch (error) { next(error); }
}

async function studentProgress(req, res, next) {
  try {
    const portal = await service.getStudentPortal(req.session.user.id);
    res.render('student-portal/progress', { title: 'Tiến độ học tập', portal });
  } catch (error) { next(error); }
}

async function studentMaterials(req, res, next) {
  try {
    const portal = await service.getStudentPortal(req.session.user.id);
    res.render('student-portal/materials', { title: 'Tài liệu học tập', portal });
  } catch (error) { next(error); }
}

async function parentDashboard(req, res, next) {
  try {
    const portal = await service.getParentPortal(req.session.user.id, req.query.childId);
    res.render('parent-portal/dashboard', { title: 'Trang phụ huynh', portal });
  } catch (error) { next(error); }
}

async function parentProgress(req, res, next) {
  try {
    const portal = await service.getParentPortal(req.session.user.id, req.query.childId);
    res.render('parent-portal/progress', { title: 'Kết quả học tập', portal });
  } catch (error) { next(error); }
}

module.exports = {
  studentDashboard,
  studentAssignments,
  studentProgress,
  studentMaterials,
  parentDashboard,
  parentProgress,
};
