const service = require('./session.service');

function renderError(res, view, data, error) {
  return res.status(400).render(view, {
    ...data,
    errorMessage: error.message || 'Dữ liệu không hợp lệ.',
  });
}

async function index(req, res, next) {
  try {
    const classId = req.query.classId || '';
    const data = await service.getPageData({ classId, teacherId: req.session.user.id });
    res.render('sessions/index', {
      title: 'Buổi học',
      ...data,
      selectedClassId: classId,
    });
  } catch (error) {
    next(error);
  }
}

async function newForm(req, res, next) {
  try {
    const data = await service.getCreateData();
    res.render('sessions/new', {
      title: 'Tạo buổi học',
      ...data,
      selectedClassId: req.query.classId || '',
      form: {
        classId: req.query.classId || '',
        sessionDate: new Date().toISOString().slice(0, 10),
        startTime: '',
        endTime: '',
        topic: '',
        lessonSummary: '',
        homework: '',
      },
      errorMessage: '',
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const created = await service.createSession(req.body, req.session.user.id);
    res.redirect(`/sessions/${created.id}?created=1`);
  } catch (error) {
    try {
      const data = await service.getCreateData();
      return renderError(res, 'sessions/new', {
        title: 'Tạo buổi học',
        ...data,
        selectedClassId: req.body.classId || '',
        form: req.body,
      }, error);
    } catch (nestedError) {
      next(nestedError);
    }
  }
}

async function detail(req, res, next) {
  try {
    const session = await service.getSession(req.params.id);
    if (!session) return res.status(404).render('errors/404', { title: 'Không tìm thấy buổi học' });
    res.render('sessions/detail', {
      title: session.topic || 'Chi tiết buổi học',
      session,
      flash: req.query.saved ? 'attendance' : req.query.created ? 'created' : req.query.note ? 'note' : req.query.completed ? 'completed' : '',
      errorMessage: '',
    });
  } catch (error) {
    next(error);
  }
}

async function saveAttendance(req, res, next) {
  try {
    await service.saveAttendance(req.params.id, req.body);
    res.redirect(`/sessions/${req.params.id}?saved=attendance`);
  } catch (error) {
    next(error);
  }
}

async function addNote(req, res, next) {
  try {
    await service.addStudentNote(req.params.id, req.body, req.session.user.fullName);
    res.redirect(`/sessions/${req.params.id}?note=1#student-notes`);
  } catch (error) {
    try {
      const session = await service.getSession(req.params.id);
      if (!session) return res.status(404).render('errors/404', { title: 'Không tìm thấy buổi học' });
      return renderError(res, 'sessions/detail', {
        title: session.topic || 'Chi tiết buổi học',
        session,
        flash: '',
      }, error);
    } catch (nestedError) {
      next(nestedError);
    }
  }
}

async function complete(req, res, next) {
  try {
    await service.completeSession(req.params.id);
    res.redirect(`/sessions/${req.params.id}?completed=1`);
  } catch (error) {
    next(error);
  }
}

async function apiList(req, res, next) {
  try {
    const data = await service.getPageData({ classId: req.query.classId, teacherId: req.session.user.id });
    res.json({ data: data.sessions });
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, detail, saveAttendance, addNote, complete, apiList };
