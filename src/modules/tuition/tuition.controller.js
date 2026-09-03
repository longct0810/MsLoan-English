const service = require('./tuition.service');

function messageForError(error) {
  const map = {
    CLASS_NOT_FOUND: 'Không tìm thấy lớp hoặc bạn không có quyền quản lý lớp này.',
    TUITION_PLAN_NOT_FOUND: 'Lớp chưa có cấu hình học phí.',
    CYCLE_NOT_FOUND: 'Không tìm thấy kỳ học phí.',
    CYCLE_ALREADY_SENT: 'Kỳ học phí đã gửi, không thể tạo lại.',
    PAYMENT_SETTINGS_REQUIRED: 'Hãy cấu hình tài khoản nhận tiền trước khi gửi thông báo học phí.',
    INVOICE_NOT_FOUND: 'Không tìm thấy thông báo học phí.',
    INVOICE_ALREADY_SENT: 'Thông báo đã gửi nên không thể thay đổi số tiền.',
    INVOICE_NOT_PAYABLE: 'Thông báo này không ở trạng thái có thể ghi nhận thanh toán.',
    INVALID_PAYMENT_AMOUNT: 'Số tiền thanh toán phải lớn hơn 0 và không vượt quá số tiền còn thiếu.',
  };
  return map[error.message] || error.message || 'Có lỗi xảy ra.';
}

async function index(req, res, next) {
  try {
    const data = await service.getTeacherDashboard(req.session.user.id);
    res.render('tuition/index', {
      title: 'Học phí & QR', ...data,
      message: req.query.saved ? 'Đã lưu cấu hình.' : req.query.generated ? 'Đã tạo/cập nhật kỳ học phí từ dữ liệu điểm danh.' : '',
      errorMessage: req.query.error ? String(req.query.error) : '',
    });
  } catch (error) { next(error); }
}

async function saveSettings(req, res) {
  try {
    await service.savePaymentSettings(req.session.user.id, req.body);
    res.redirect('/teacher/tuition?saved=1');
  } catch (error) {
    res.redirect(`/teacher/tuition?error=${encodeURIComponent(messageForError(error))}`);
  }
}

async function savePlan(req, res) {
  try {
    await service.saveClassPlan(req.session.user.id, req.params.classId, req.body);
    res.redirect('/teacher/tuition?saved=1#plans');
  } catch (error) {
    res.redirect(`/teacher/tuition?error=${encodeURIComponent(messageForError(error))}#plans`);
  }
}

async function createCycle(req, res) {
  try {
    const cycleId = await service.createCycle(req.session.user.id, req.body);
    res.redirect(`/teacher/tuition/cycles/${cycleId}?generated=1`);
  } catch (error) {
    res.redirect(`/teacher/tuition?error=${encodeURIComponent(messageForError(error))}#cycles`);
  }
}

async function cycleDetail(req, res, next) {
  try {
    const cycle = await service.getCycle(req.session.user.id, req.params.id);
    if (!cycle) return res.status(404).render('errors/404', { title: 'Không tìm thấy kỳ học phí' });
    res.render('tuition/cycle', {
      title: `Học phí ${cycle.className}`,
      cycle,
      message: req.query.generated ? 'Đã tính lại học phí từ dữ liệu điểm danh.' : req.query.sent ? 'Đã gửi thông báo học phí cho phụ huynh.' : '',
      errorMessage: req.query.error ? String(req.query.error) : '',
    });
  } catch (error) { next(error); }
}

async function sendCycle(req, res) {
  try {
    await service.sendCycle(req.session.user.id, req.params.id);
    res.redirect(`/teacher/tuition/cycles/${req.params.id}?sent=1`);
  } catch (error) {
    res.redirect(`/teacher/tuition/cycles/${req.params.id}?error=${encodeURIComponent(messageForError(error))}`);
  }
}

async function invoiceDetail(req, res, next) {
  try {
    const invoice = await service.getTeacherInvoice(req.session.user.id, req.params.id);
    if (!invoice) return res.status(404).render('errors/404', { title: 'Không tìm thấy thông báo học phí' });
    res.render('tuition/invoice', {
      title: `Học phí - ${invoice.studentName}`,
      invoice,
      message: req.query.saved ? 'Đã cập nhật số tiền.' : req.query.paid ? 'Đã ghi nhận thanh toán.' : '',
      errorMessage: req.query.error ? String(req.query.error) : '',
    });
  } catch (error) { next(error); }
}

async function updateInvoice(req, res) {
  try {
    await service.updateInvoice(req.session.user.id, req.params.id, req.body);
    res.redirect(`/teacher/tuition/invoices/${req.params.id}?saved=1`);
  } catch (error) {
    res.redirect(`/teacher/tuition/invoices/${req.params.id}?error=${encodeURIComponent(messageForError(error))}`);
  }
}

async function recordPayment(req, res) {
  try {
    await service.recordPayment(req.session.user.id, req.params.id, req.body);
    res.redirect(`/teacher/tuition/invoices/${req.params.id}?paid=1`);
  } catch (error) {
    res.redirect(`/teacher/tuition/invoices/${req.params.id}?error=${encodeURIComponent(messageForError(error))}`);
  }
}

async function parentIndex(req, res, next) {
  try {
    const tuition = await service.getParentTuition(req.session.user.id, req.query.childId);
    res.render('parent-portal/tuition', { title: 'Học phí', tuition });
  } catch (error) { next(error); }
}

async function parentInvoice(req, res, next) {
  try {
    const invoice = await service.getParentInvoice(req.session.user.id, req.params.id);
    if (!invoice) return res.status(404).render('errors/404', { title: 'Không tìm thấy thông báo học phí' });
    res.render('parent-portal/tuition-invoice', { title: 'Thông báo học phí', invoice });
  } catch (error) { next(error); }
}

module.exports = {
  index, saveSettings, savePlan, createCycle, cycleDetail, sendCycle,
  invoiceDetail, updateInvoice, recordPayment, parentIndex, parentInvoice,
};
