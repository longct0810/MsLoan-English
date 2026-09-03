const env = require('../../config/env');
const repo = require('./tuition.repository');
const { buildVietQrImageUrl } = require('./tuition.qr');

const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ONLINE', 'ABSENT', 'ABSENT_EXCUSED'];
const BANK_PRESETS = [
  { name: 'MB Bank', code: 'MB', bin: '970422' },
  { name: 'Vietcombank', code: 'VCB', bin: '970436' },
  { name: 'BIDV', code: 'BIDV', bin: '970418' },
  { name: 'VietinBank', code: 'ICB', bin: '970415' },
  { name: 'Techcombank', code: 'TCB', bin: '970407' },
  { name: 'ACB', code: 'ACB', bin: '970416' },
  { name: 'VPBank', code: 'VPB', bin: '970432' },
];

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(month) {
  const match = String(month || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Tháng học phí không hợp lệ.');
  const year = Number(match[1]);
  const monthNo = Number(match[2]);
  if (year < 2020 || year > 2100 || monthNo < 1 || monthNo > 12) throw new Error('Tháng học phí không hợp lệ.');
  const lastDay = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();
  return {
    periodMonth: `${match[1]}-${match[2]}-01`,
    fromDate: `${match[1]}-${match[2]}-01`,
    toDate: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
}

function defaultDueDate(month) {
  const match = String(month || currentMonth()).match(/^(\d{4})-(\d{2})$/);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const next = new Date(Date.UTC(y, m, 5));
  return next.toISOString().slice(0, 10);
}

function clean(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function number(value) {
  const n = Number(String(value ?? '').replace(/[,.\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function normalizeInvoice(invoice) {
  if (!invoice) return null;
  const payment = invoice.paymentSnapshot || {};
  const remainingAmount = Math.max(0, Number(invoice.finalAmount || 0) - Number(invoice.amountPaid || 0));
  const transferContent = invoice.publicCode || '';
  const qrImageUrl = ['UNPAID', 'PARTIAL'].includes(invoice.status)
    ? buildVietQrImageUrl({
        bankBin: payment.bankBin,
        accountNo: payment.bankAccountNo,
        accountName: payment.bankAccountName,
        amount: remainingAmount,
        transferContent,
      })
    : null;
  const attendanceRows = Array.isArray(invoice.calculationSnapshot?.attendance)
    ? invoice.calculationSnapshot.attendance
    : [];
  const sourceCounts = attendanceRows.reduce((acc, row) => {
    const key = row.sourceType || 'MANUAL';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return { ...invoice, remainingAmount, transferContent, qrImageUrl, attendanceRows, sourceCounts };
}

async function getTeacherDashboard(teacherId) {
  const data = await repo.getDashboard(teacherId);
  return {
    ...data,
    defaultMonth: currentMonth(),
    defaultDueDate: defaultDueDate(currentMonth()),
    bankPresets: BANK_PRESETS,
    demoMode: env.demo.enabled,
  };
}

async function savePaymentSettings(teacherId, input) {
  const bankName = clean(input.bankName, 120);
  const bankCode = clean(input.bankCode, 30);
  const bankBin = clean(input.bankBin, 20).replace(/\D/g, '');
  const bankAccountNo = clean(input.bankAccountNo, 60).replace(/\s+/g, '');
  const bankAccountName = clean(input.bankAccountName, 200).toUpperCase();
  if (!bankName) throw new Error('Vui lòng nhập tên ngân hàng.');
  if (!/^\d{6}$/.test(bankBin)) throw new Error('BIN ngân hàng cần gồm 6 chữ số.');
  if (!/^[A-Za-z0-9.-]{4,60}$/.test(bankAccountNo)) throw new Error('Số tài khoản không hợp lệ.');
  if (!bankAccountName) throw new Error('Vui lòng nhập tên chủ tài khoản.');
  return repo.upsertPaymentSettings(teacherId, { bankName, bankCode, bankBin, bankAccountNo, bankAccountName });
}

async function saveClassPlan(teacherId, classId, input) {
  const unitPrice = number(input.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10000000) throw new Error('Đơn giá học phí không hợp lệ.');
  const billedStatuses = ATTENDANCE_STATUSES.filter((status) => input[`status_${status}`] === 'on' || input[`status_${status}`] === '1');
  if (!billedStatuses.length) throw new Error('Cần chọn ít nhất một trạng thái điểm danh được tính học phí.');
  const name = clean(input.name, 200) || 'Học phí theo buổi';
  return repo.upsertPlan(teacherId, Number(classId), { name, unitPrice: Math.round(unitPrice), billedStatuses });
}

async function createCycle(teacherId, input) {
  const classId = Number(input.classId);
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('Vui lòng chọn lớp.');
  const bounds = monthBounds(input.month);
  const dueDate = dateOnly(input.dueDate) || defaultDueDate(input.month);
  if (dueDate < bounds.fromDate) throw new Error('Hạn thanh toán không thể trước kỳ học phí.');
  return repo.generateCycle({ teacherId, classId, ...bounds, dueDate, createdBy: teacherId });
}

async function getCycle(teacherId, cycleId) {
  return repo.getCycle(teacherId, Number(cycleId));
}

async function sendCycle(teacherId, cycleId) {
  return repo.sendCycle(teacherId, Number(cycleId));
}

async function updateInvoice(teacherId, invoiceId, input) {
  const discountAmount = number(input.discountAmount || 0);
  const otherFeeAmount = number(input.otherFeeAmount || 0);
  if (![discountAmount, otherFeeAmount].every((v) => Number.isFinite(v) && v >= 0 && v <= 100000000)) {
    throw new Error('Số tiền điều chỉnh không hợp lệ.');
  }
  return repo.updateInvoiceAdjustments(teacherId, Number(invoiceId), {
    discountAmount: Math.round(discountAmount),
    otherFeeAmount: Math.round(otherFeeAmount),
    note: clean(input.note, 3000),
  });
}

async function getTeacherInvoice(teacherId, invoiceId) {
  return normalizeInvoice(await repo.getTeacherInvoice(teacherId, Number(invoiceId)));
}

async function recordPayment(teacherId, invoiceId, input) {
  const amount = number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền thanh toán không hợp lệ.');
  const paymentMethod = ['BANK_TRANSFER', 'CASH', 'OTHER'].includes(input.paymentMethod) ? input.paymentMethod : 'BANK_TRANSFER';
  return repo.recordPayment(teacherId, Number(invoiceId), {
    amount: Math.round(amount), paymentMethod,
    paidAt: clean(input.paidAt, 40), referenceNo: clean(input.referenceNo, 150), note: clean(input.note, 2000),
  }, teacherId);
}

async function getParentTuition(parentUserId, requestedStudentId) {
  const children = await repo.getChildren(parentUserId);
  if (!children.length) return { children: [], selected: null, invoices: [], outstanding: 0 };
  const allowed = new Set(children.map((child) => Number(child.id)));
  const selectedId = allowed.has(Number(requestedStudentId)) ? Number(requestedStudentId) : Number(children[0].id);
  const invoices = await repo.getParentInvoices(parentUserId, selectedId);
  return {
    children,
    selected: children.find((child) => Number(child.id) === selectedId),
    invoices,
    outstanding: invoices.filter((i) => ['UNPAID', 'PARTIAL'].includes(i.status)).reduce((sum, i) => sum + Math.max(0, Number(i.finalAmount || 0) - Number(i.amountPaid || 0)), 0),
  };
}

async function getParentInvoice(parentUserId, invoiceId) {
  return normalizeInvoice(await repo.getParentInvoice(parentUserId, Number(invoiceId)));
}

async function getParentStudentOutstanding(parentUserId, studentId) {
  const portal = await getParentTuition(parentUserId, studentId);
  return { outstanding: portal.outstanding, invoices: portal.invoices.filter((i) => ['UNPAID', 'PARTIAL'].includes(i.status)) };
}

module.exports = {
  getTeacherDashboard,
  savePaymentSettings,
  saveClassPlan,
  createCycle,
  getCycle,
  sendCycle,
  updateInvoice,
  getTeacherInvoice,
  recordPayment,
  getParentTuition,
  getParentInvoice,
  getParentStudentOutstanding,
  monthBounds,
  defaultDueDate,
  buildVietQrImageUrl,
};
