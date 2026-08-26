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

module.exports = { getStudentPortal, getParentPortal };
