const repo = require('./portal.repository');

function statusMeta(status) {
  const map = {
    SUBMITTED: { label: 'Đã nộp', className: 'text-bg-success' },
    GRADED: { label: 'Đã chấm', className: 'text-bg-success' },
    LATE: { label: 'Trễ hạn', className: 'text-bg-danger' },
    NOT_STARTED: { label: 'Chưa làm', className: 'text-bg-warning' },
  };
  return map[status] || { label: status, className: 'text-bg-secondary' };
}

function attendanceMeta(status) {
  const map = {
    PRESENT: { label: 'Có mặt', className: 'text-bg-success' },
    LATE: { label: 'Đi muộn', className: 'text-bg-warning' },
    ABSENT: { label: 'Vắng', className: 'text-bg-danger' },
    ABSENT_EXCUSED: { label: 'Vắng có phép', className: 'text-bg-info' },
    ONLINE: { label: 'Học online', className: 'text-bg-primary' },
  };
  return map[status] || { label: status, className: 'text-bg-secondary' };
}

function enrich(snapshot) {
  if (!snapshot) return null;
  snapshot.assignments = snapshot.assignments.map((a) => ({
    ...a,
    statusMeta: statusMeta(a.submission.status),
  }));
  snapshot.attendance = snapshot.attendance.map((a) => ({ ...a, statusMeta: attendanceMeta(a.status) }));
  snapshot.pendingAssignments = snapshot.assignments.filter((a) => !['SUBMITTED', 'GRADED'].includes(a.submission.status));
  snapshot.latestScores = snapshot.scores.slice(0, 5);
  snapshot.latestNote = snapshot.notes[0] || null;
  return snapshot;
}

async function getStudentPortal(userId) {
  const studentId = await repo.getStudentIdByUserId(userId);
  if (!studentId) return null;
  const snapshot = enrich(await repo.getStudentSnapshot(studentId));
  if (snapshot) {
    // In MVP, notes not shared with parents are treated as teacher-internal notes.
    snapshot.notes = snapshot.notes.filter((note) => note.isParentVisible !== false);
    snapshot.latestNote = snapshot.notes[0] || null;
  }
  return snapshot;
}

async function getParentPortal(parentUserId, requestedStudentId) {
  const children = await repo.getChildrenByParentUserId(parentUserId);
  if (!children.length) return { children: [], selected: null, snapshot: null };

  const allowedIds = new Set(children.map((c) => Number(c.id)));
  const selectedId = allowedIds.has(Number(requestedStudentId)) ? Number(requestedStudentId) : Number(children[0].id);
  const snapshot = enrich(await repo.getStudentSnapshot(selectedId));
  if (snapshot) {
    snapshot.notes = snapshot.notes.filter((note) => note.isParentVisible !== false);
    snapshot.latestNote = snapshot.notes[0] || null;
  }
  return { children, selected: children.find((c) => Number(c.id) === selectedId), snapshot };
}

async function getParentReport(parentUserId, requestedStudentId, month) {
  const children = await repo.getChildrenByParentUserId(parentUserId);
  if (!children.length) return { children: [], selected: null, report: null };
  const allowedIds = new Set(children.map((child) => Number(child.id)));
  const selectedId = allowedIds.has(Number(requestedStudentId)) ? Number(requestedStudentId) : Number(children[0].id);
  return { children, selected: children.find((child) => Number(child.id) === selectedId), report: await repo.getParentReport(selectedId, month) };
}

async function getParentNotifications(parentUserId, requestedStudentId) {
  const children = await repo.getChildrenByParentUserId(parentUserId);
  if (!children.length) return { children: [], selected: null, notifications: [] };
  const allowedIds = new Set(children.map((child) => Number(child.id)));
  const selectedId = allowedIds.has(Number(requestedStudentId)) ? Number(requestedStudentId) : Number(children[0].id);
  const snapshot = enrich(await repo.getStudentSnapshot(selectedId));
  if (!snapshot) return { children, selected: children.find((child) => Number(child.id) === selectedId), notifications: [] };
  snapshot.notes = snapshot.notes.filter((note) => note.isParentVisible !== false);
  const now = Date.now();
  const notifications = [];
  snapshot.assignments.filter((item) => item.submission.status === 'LATE').forEach((item) => notifications.push({ type: 'warning', title: 'Bài tập được nộp trễ', body: `${item.title} của ${snapshot.student.fullName} đã được nộp trễ.`, date: item.submission.submittedAt || item.dueAt, href: '/parent/reports' }));
  snapshot.assignments.filter((item) => item.submission.status === 'NOT_STARTED' && item.dueAt && new Date(item.dueAt).getTime() >= now && new Date(item.dueAt).getTime() - now <= 7 * 86400000).forEach((item) => notifications.push({ type: 'info', title: 'Bài tập sắp đến hạn', body: `${item.title} còn hạn đến ${new Date(item.dueAt).toLocaleDateString('vi-VN')}.`, date: item.dueAt, href: '/parent/reports' }));
  snapshot.scores.slice(0, 5).forEach((item) => notifications.push({ type: 'success', title: 'Có điểm mới', body: `${item.title}: ${item.score}/${item.maxScore || 10}.`, date: item.recordedAt, href: '/parent/progress' }));
  snapshot.notes.slice(0, 5).forEach((item) => notifications.push({ type: 'note', title: 'Nhận xét mới từ giáo viên', body: item.note, date: item.createdAt, href: '/parent/progress' }));
  snapshot.attendance.filter((item) => ['ABSENT', 'ABSENT_EXCUSED', 'LATE'].includes(item.status)).slice(0, 5).forEach((item) => notifications.push({ type: 'warning', title: 'Cập nhật chuyên cần', body: `${snapshot.student.fullName}: ${attendanceMeta(item.status).label} ngày ${new Date(item.date).toLocaleDateString('vi-VN')}.`, date: item.date, href: '/parent/progress' }));
  notifications.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const reads = await repo.getParentNotificationReads(parentUserId);
  const visible = notifications.slice(0, 20).map((item) => ({ ...item, key: `${item.type}:${item.date}:${item.title}:${item.body}`.slice(0, 500) }));
  visible.forEach((item) => { item.isRead = reads.has(item.key); });
  return { children, selected: children.find((child) => Number(child.id) === selectedId), notifications: visible, unreadCount: visible.filter((item) => !item.isRead).length };
}

async function markParentNotificationRead(parentUserId, notificationKey) {
  const key = String(notificationKey || '').trim();
  if (!key || key.length > 500) throw new Error('INVALID_NOTIFICATION');
  return repo.markParentNotificationRead(parentUserId, key);
}

async function markAllParentNotificationsRead(parentUserId, requestedStudentId) {
  const portal = await getParentNotifications(parentUserId, requestedStudentId);
  return repo.markParentNotificationsRead(parentUserId, portal.notifications.map((item) => item.key));
}

module.exports = { getStudentPortal, getParentPortal, getParentReport, getParentNotifications, markParentNotificationRead, markAllParentNotificationsRead };
