const service = require('./lesson.service');

function messageFor(error) {
  const messages = {
    TITLE_REQUIRED: 'Vui lòng nhập tên bài học.',
    CLASS_REQUIRED: 'Vui lòng chọn lớp.',
    CLASS_NOT_FOUND: 'Không tìm thấy lớp học.',
    MATERIAL_TITLE_REQUIRED: 'Vui lòng nhập tên tài liệu.',
    INVALID_RESOURCE_URL: 'URL tài liệu phải bắt đầu bằng http:// hoặc https://.',
  };
  return messages[error.message] || 'Không thể thực hiện thao tác.';
}

async function index(req, res, next) {
  try {
    const data = await service.list(req.query, req.session.user.id, req.session.user.role === 'ADMIN');
    res.render('lessons/index', { title: 'Bài học & tài liệu', ...data, filters: req.query });
  } catch (error) { next(error); }
}

async function newForm(req, res, next) {
  try {
    res.render('lessons/new', { title: 'Tạo bài học', ...(await service.newForm(req.session.user.id, req.session.user.role === 'ADMIN')), error: null, values: {} });
  } catch (error) { next(error); }
}

async function create(req, res, next) {
  try {
    const lesson = await service.create(req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/lessons/${lesson.id}?created=1`);
  } catch (error) {
    if (['TITLE_REQUIRED', 'CLASS_REQUIRED', 'CLASS_NOT_FOUND'].includes(error.message)) {
      const data = await service.newForm(req.session.user.id, req.session.user.role === 'ADMIN');
      return res.status(400).render('lessons/new', { title: 'Tạo bài học', ...data, error: messageFor(error), values: req.body });
    }
    next(error);
  }
}


async function editForm(req, res, next) {
  try {
    const data = await service.editForm(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!data.lesson) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài học' });
    res.render('lessons/edit', { title: `Sửa ${data.lesson.title}`, ...data, error: null, values: data.lesson });
  } catch (error) { next(error); }
}

async function update(req, res, next) {
  try {
    await service.update(req.params.id, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/lessons/${req.params.id}?updated=1`);
  } catch (error) {
    if (error.message === 'LESSON_NOT_FOUND') return res.status(404).render('errors/404', { title: 'Không tìm thấy bài học' });
    if (['TITLE_REQUIRED','CLASS_REQUIRED','CLASS_NOT_FOUND'].includes(error.message)) {
      const data = await service.editForm(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
      if (!data.lesson) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài học' });
      return res.status(400).render('lessons/edit', { title: `Sửa ${data.lesson.title}`, ...data, error: messageFor(error), values: req.body });
    }
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    const lesson = await service.detail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    if (!lesson) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài học' });
    const message = req.query.created ? 'Đã tạo bài học.' : (req.query.updated ? 'Đã cập nhật bài học.' : (req.query.published ? 'Đã xuất bản bài học.' : null));
    res.render('lessons/detail', { title: lesson.title, lesson, message, error: null });
  } catch (error) { next(error); }
}

async function publish(req, res, next) {
  try {
    await service.publish(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/lessons/${req.params.id}?published=1`);
  } catch (error) { next(error); }
}

async function addMaterial(req, res, next) {
  try {
    await service.addMaterial(req.params.id, req.body, req.session.user.id, req.session.user.role === 'ADMIN');
    res.redirect(`/lessons/${req.params.id}#materials`);
  } catch (error) {
    if (['MATERIAL_TITLE_REQUIRED', 'INVALID_RESOURCE_URL'].includes(error.message)) {
      const lesson = await service.detail(req.params.id, req.session.user.id, req.session.user.role === 'ADMIN');
      if (!lesson) return res.status(404).render('errors/404', { title: 'Không tìm thấy bài học' });
      return res.status(400).render('lessons/detail', { title: lesson.title, lesson, message: null, error: messageFor(error) });
    }
    next(error);
  }
}

async function apiList(req, res, next) {
  try { res.json({ data: (await service.list(req.query, req.session.user.id, req.session.user.role === 'ADMIN')).lessons }); } catch (error) { next(error); }
}

module.exports = { index, newForm, create, editForm, update, detail, publish, addMaterial, apiList };
