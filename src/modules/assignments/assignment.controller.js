const service = require('./assignment.service');

const MESSAGES = {
  CLASS_REQUIRED: 'Vui lòng chọn lớp.',
  TITLE_REQUIRED: 'Vui lòng nhập tên bài tập.',
  INVALID_MAX_SCORE: 'Điểm tối đa không hợp lệ.',
  INVALID_DUE_AT: 'Hạn nộp không hợp lệ.',
  CLASS_NOT_FOUND: 'Không tìm thấy lớp.',
  LESSON_CLASS_MISMATCH: 'Bài học không thuộc lớp đã chọn.',
  INVALID_SCORE: 'Điểm chấm không hợp lệ.',
  SUBMISSION_REQUIRED: 'Vui lòng nhập nội dung bài làm trước khi nộp.',
  GRADED_LOCKED: 'Bài đã được giáo viên chấm và đang khóa nộp lại.',
};

function message(error) { return MESSAGES[error.message] || 'Không thể thực hiện thao tác.'; }

async function index(req, res, next) {
  try {
    res.render('assignments/index', { title: 'Bài tập & chấm bài', ...(await service.list(req.query, req.session.user.id, req.session.user.role === 'ADMIN')), filters: req.query });
  } catch (error) { next(error); }
}

async function newForm(req, res, next) {
  try {
    res.render('assignments/new', { title: 'Giao bài tập', ...(await service.newForm(req.query, req.session.user.id, req.session.user.role === 'ADMIN')), error: null, values: req.query });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const assignment = await service.create(req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/assignments/${assignment.id}?created=1`);
  } catch (error) {
    if (Object.prototype.hasOwnProperty.call(MESSAGES, error.message)) {
      const data = await service.newForm({ classId: req.body.classId }, req.session.user.id, req.session.user.role === 'ADMIN');
      return res.status(400).render('assignments/new', { title: 'Giao bài tập', ...data, error: message(error), values: req.body });
    }
    next(error);
  }
}


async function editForm(req, res, next) {
  try {
    const data = await service.editForm(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!data.assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
    let dueAt = '';
    if (data.assignment.dueAt) {
      const date = new Date(data.assignment.dueAt);
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      dueAt = local.toISOString().slice(0, 16);
    }
    const values = { ...data.assignment, dueAt };
    res.render('assignments/edit', { title: `Sửa ${data.assignment.title}`, ...data, values, error: null });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    await service.update(req.params.id, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/assignments/${req.params.id}?updated=1`);
  } catch (error) {
    if (error.message === 'ASSIGNMENT_NOT_FOUND') return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
    if (Object.prototype.hasOwnProperty.call(MESSAGES, error.message)) {
      const data = await service.editForm(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
      if (!data.assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
      return res.status(400).render('assignments/edit', { title: `Sửa ${data.assignment.title}`, ...data, error: message(error), values: req.body });
    }
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const assignment = await service.detail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
    const notice = req.query.created ? 'Đã tạo bài tập.' : (req.query.updated ? 'Đã cập nhật bài tập.' : (req.query.published ? 'Đã xuất bản bài tập.' : (req.query.graded ? 'Đã lưu điểm và phản hồi.' : null)));
    res.render('assignments/detail', { title: assignment.title, assignment, notice, error: null });
  } catch (error) { next(error); }
}

async function publish(req, res, next) {
  try {
    await service.publish(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/assignments/${req.params.id}?published=1`);
  } catch (error) { next(error); }
}

async function grade(req, res, next) {
  try {
    await service.grade(req.params.id, req.params.studentId, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/assignments/${req.params.id}?graded=1#student-${req.params.studentId}`);
  } catch (error) {
    if (error.message === 'INVALID_SCORE') {
      const assignment = await service.detail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
      if (!assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
      return res.status(400).render('assignments/detail', { title: assignment.title, assignment, notice: null, error: message(error) });
    }
    next(error);
  }
}

async function studentDetail(req, res, next) {
  try {
    const assignment = await service.getStudentAssignment(req.params.id, req.session.user.id);
    if (!assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
    res.render('student-portal/assignment-detail', { title: assignment.title, assignment, error: null, submitted: req.query.submitted === '1' });
  } catch (error) { next(error); }
}

async function studentSubmit(req, res, next) {
  try {
    await service.submitStudentAssignment(req.params.id, req.session.user.id, req.body);
    res.redirect(`/student/assignments/${req.params.id}?submitted=1`);
  } catch (error) {
    if (['SUBMISSION_REQUIRED', 'GRADED_LOCKED'].includes(error.message)) {
      const assignment = await service.getStudentAssignment(req.params.id, req.session.user.id);
      if (!assignment) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài tập' });
      return res.status(400).render('student-portal/assignment-detail', { title: assignment.title, assignment, error: message(error), submitted: false });
    }
    next(error);
  }
}

async function apiList(req, res, next) {
  try { res.json({ data: (await service.list(req.query, req.session.user.id, req.session.user.role === 'ADMIN')).assignments }); } catch (error) { next(error); }
}

module.exports = { index, newForm, create, editForm, update, detail, publish, grade, studentDetail, studentSubmit, apiList };
