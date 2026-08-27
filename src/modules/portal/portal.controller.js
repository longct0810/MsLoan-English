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

async function parentReports(req, res, next) {
  try {
    const portal = await service.getParentReport(req.session.user.id, req.query.childId, req.query.month);
    res.render('parent-portal/reports', { title: 'Báo cáo học tập', portal });
  } catch (error) { next(error); }
}

async function parentReportCsv(req, res, next) {
  try {
    const portal = await service.getParentReport(req.session.user.id, req.query.childId, req.query.month);
    if (!portal.report) return res.status(404).send('Report not found');
    const report = portal.report;
    const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Báo cáo học tập', report.student.fullName, report.month],
      [],
      ['Chỉ số', 'Giá trị'],
      ['Điểm trung bình', report.metrics.average ?? ''],
      ['Chuyên cần (%)', report.metrics.attendanceRate ?? ''],
      ['Bài đã nộp', `${report.metrics.submitted}/${report.metrics.totalAssignments}`],
      ['Bài nộp trễ', report.metrics.late],
      [],
      ['Điểm số', 'Danh mục', 'Điểm', 'Điểm tối đa', 'Ngày'],
      ...report.scores.map((score) => [score.title, score.category, score.score, score.maxScore, score.recordedAt]),
      [],
      ['Bài tập', 'Trạng thái', 'Điểm', 'Hạn nộp'],
      ...report.assignments.map((assignment) => [assignment.title, assignment.submission.status, assignment.submission.score ?? '', assignment.dueAt || '']),
      [],
      ['Chuyên cần', 'Trạng thái', 'Ghi chú'],
      ...report.attendance.map((item) => [item.date, item.status, item.note]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="parent-report-${report.month}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

async function parentNotifications(req, res, next) {
  try {
    const portal = await service.getParentNotifications(req.session.user.id, req.query.childId);
    res.render('parent-portal/notifications', { title: 'Thông báo', portal });
  } catch (error) { next(error); }
}

async function markParentNotificationRead(req, res, next) {
  try {
    await service.markParentNotificationRead(req.session.user.id, req.body.notificationKey);
    const childQuery = req.body.childId ? `?childId=${encodeURIComponent(req.body.childId)}` : '';
    res.redirect(`/parent/notifications${childQuery}`);
  } catch (error) { next(error); }
}

module.exports = {
  studentDashboard,
  studentAssignments,
  studentProgress,
  studentMaterials,
  parentDashboard,
  parentProgress,
  parentReports,
  parentReportCsv,
  parentNotifications,
  markParentNotificationRead,
};
