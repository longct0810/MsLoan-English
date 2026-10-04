'use strict';

function prioritizeAssignments(assignments) {
  const followUp = (item) => ['NOT_STARTED', 'LATE'].includes(item.submission?.status) ? 0 : 1;
  return [...assignments].sort((left, right) => {
    const statusOrder = followUp(left) - followUp(right);
    if (statusOrder) return statusOrder;
    return new Date(left.dueAt || '2999-12-31') - new Date(right.dueAt || '2999-12-31');
  });
}

function prioritizeTeacherAssignments(assignments) {
  const rank = (item) => item.status === 'PUBLISHED'
    && (Number(item.submitted) > Number(item.graded) || Number(item.total) > Number(item.submitted)) ? 0
    : item.status === 'DRAFT' ? 1 : 2;
  return [...assignments].sort((left, right) => rank(left) - rank(right)
    || new Date(left.dueAt || '2999-12-31') - new Date(right.dueAt || '2999-12-31'));
}

module.exports = { prioritizeAssignments, prioritizeTeacherAssignments };