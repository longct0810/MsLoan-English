const ExcelJS = require('exceljs');
const service = require('./report.service');

function isAdmin(req) { return req.session.user.role === 'ADMIN'; }

function safeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatMetric(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${value}${suffix}`;
}

async function index(req, res, next) {
  try {
    const report = await service.getReport(req.session.user.id, isAdmin(req), req.query);
    res.render('reports/index', { title: 'Báo cáo', report });
  } catch (error) {
    if (error.message === 'CLASS_NOT_FOUND') return res.status(403).render('errors/403', { title: 'Không có quyền truy cập' });
    next(error);
  }
}

async function studentDetail(req, res, next) {
  try {
    const detail = await service.getStudentReport(req.session.user.id, isAdmin(req), req.params.studentId, req.query);
    if (!detail) return res.status(404).render('errors/404', { title: 'Không tìm thấy báo cáo học viên' });
    res.render('reports/student', { title: `Báo cáo - ${detail.student.fullName}`, detail });
  } catch (error) { next(error); }
}

async function csv(req, res, next) {
  try {
    const report = await service.getReport(req.session.user.id, isAdmin(req), req.query);
    const lines = [];
    lines.push(['Báo cáo giáo viên', `Tháng ${report.month}`].map(safeCsv).join(','));
    lines.push(['Học viên', report.metrics.studentCount, 'Điểm TB /10', formatMetric(report.metrics.averageScore), 'Chuyên cần', formatMetric(report.metrics.attendanceRate, '%'), 'Nộp bài', formatMetric(report.metrics.submissionRate, '%'), 'Chờ chấm', report.metrics.pendingGrading].map(safeCsv).join(','));
    lines.push('');
    lines.push(['Lớp', 'Khối', 'Học viên', 'Điểm TB /10', 'Chuyên cần %', 'Nộp bài %', 'Chờ chấm', 'Cần chú ý'].map(safeCsv).join(','));
    report.classStats.forEach((item) => lines.push([item.name, item.grade, item.studentCount, formatMetric(item.averageScore), formatMetric(item.attendanceRate), formatMetric(item.submissionRate), item.pendingGrading, item.attentionCount].map(safeCsv).join(',')));
    lines.push('');
    lines.push(['Học viên cần chú ý', 'Lớp', 'Mức', 'Điểm TB /10', 'Chuyên cần %', 'Bài quá hạn', 'Lý do'].map(safeCsv).join(','));
    report.attention.forEach((item) => lines.push([item.fullName, item.className, item.priority, formatMetric(item.averageScore), formatMetric(item.attendanceRate), item.overdueCount, item.reasons.join('; ')].map(safeCsv).join(',')));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="teacher-report-${report.month}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  } catch (error) {
    if (error.message === 'CLASS_NOT_FOUND') return res.status(403).send('Forbidden');
    next(error);
  }
}

async function xlsx(req, res, next) {
  try {
    const report = await service.getReport(req.session.user.id, isAdmin(req), req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'English Classroom';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Tổng quan');
    summary.columns = [{ width: 28 }, { width: 20 }];
    summary.addRows([
      ['BÁO CÁO GIÁO VIÊN', `Tháng ${report.month}`],
      ['Học viên', report.metrics.studentCount],
      ['Điểm trung bình /10', report.metrics.averageScore ?? '-'],
      ['Chuyên cần (%)', report.metrics.attendanceRate ?? '-'],
      ['Nộp bài (%)', report.metrics.submissionRate ?? '-'],
      ['Đang chờ chấm', report.metrics.pendingGrading],
    ]);
    summary.getRow(1).font = { bold: true, size: 14 };

    const classSheet = workbook.addWorksheet('Theo lớp');
    classSheet.columns = [
      { header: 'Lớp', key: 'name', width: 28 }, { header: 'Khối', key: 'grade', width: 10 },
      { header: 'Học viên', key: 'studentCount', width: 12 }, { header: 'Điểm TB /10', key: 'averageScore', width: 14 },
      { header: 'Chuyên cần %', key: 'attendanceRate', width: 15 }, { header: 'Nộp bài %', key: 'submissionRate', width: 13 },
      { header: 'Chờ chấm', key: 'pendingGrading', width: 12 }, { header: 'Cần chú ý', key: 'attentionCount', width: 12 },
    ];
    report.classStats.forEach((item) => classSheet.addRow(item));
    classSheet.getRow(1).font = { bold: true };
    classSheet.views = [{ state: 'frozen', ySplit: 1 }];
    classSheet.autoFilter = { from: 'A1', to: 'H1' };

    const attention = workbook.addWorksheet('Cần chú ý');
    attention.columns = [
      { header: 'Học viên', key: 'fullName', width: 28 }, { header: 'Lớp', key: 'className', width: 25 },
      { header: 'Mức', key: 'priority', width: 12 }, { header: 'Điểm TB /10', key: 'averageScore', width: 14 },
      { header: 'Chuyên cần %', key: 'attendanceRate', width: 15 }, { header: 'Bài quá hạn', key: 'overdueCount', width: 14 },
      { header: 'Lý do', key: 'reasonText', width: 48 },
    ];
    report.attention.forEach((item) => attention.addRow({ ...item, reasonText: item.reasons.join('; ') }));
    attention.getRow(1).font = { bold: true };
    attention.views = [{ state: 'frozen', ySplit: 1 }];
    attention.autoFilter = { from: 'A1', to: 'G1' };

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="teacher-report-${report.month}.xlsx"`);
    res.end(Buffer.from(buffer));
  } catch (error) {
    if (error.message === 'CLASS_NOT_FOUND') return res.status(403).send('Forbidden');
    next(error);
  }
}

module.exports = { index, studentDetail, csv, xlsx };
