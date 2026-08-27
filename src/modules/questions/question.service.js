const env = require('../../config/env');
const repo = require('./question.repository');
const { parseQuestionFile, buildTemplateBuffer } = require('./question.import');
const classService = require('../classes/class.service');

const TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'ESSAY'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const STATUSES = ['DRAFT', 'PUBLISHED'];

function clean(value) {
  return String(value ?? '').trim();
}

function token(value) {
  return clean(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeType(value) {
  const valueToken = token(value);
  const map = {
    MCQ: 'MULTIPLE_CHOICE', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE', TRAC_NGHIEM: 'MULTIPLE_CHOICE', TRACNGHIEM: 'MULTIPLE_CHOICE',
    TRUEFALSE: 'TRUE_FALSE', TRUE_FALSE: 'TRUE_FALSE', TF: 'TRUE_FALSE', DUNG_SAI: 'TRUE_FALSE', DUNGSAI: 'TRUE_FALSE',
    DIEN_TU: 'FILL_BLANK', DIENTU: 'FILL_BLANK', FILL: 'FILL_BLANK', FILL_BLANK: 'FILL_BLANK',
    TU_LUAN: 'ESSAY', TULUAN: 'ESSAY', WRITING: 'ESSAY', ESSAY: 'ESSAY',
  };
  return map[valueToken] || valueToken;
}

function normalizeDifficulty(value) {
  const valueToken = token(value);
  return DIFFICULTIES.includes(valueToken) ? valueToken : 'MEDIUM';
}

function normalizeStatus(value) {
  const valueToken = token(value);
  return STATUSES.includes(valueToken) ? valueToken : 'DRAFT';
}

function normalizeCorrectOption(value, type) {
  let valueToken = token(value);
  if (type === 'TRUE_FALSE') {
    if (['TRUE', 'DUNG', 'A', 'YES'].includes(valueToken)) valueToken = 'A';
    if (['FALSE', 'SAI', 'B', 'NO'].includes(valueToken)) valueToken = 'B';
  }
  return valueToken;
}

function validateData(data) {
  if (!TYPES.includes(data.questionType)) throw new Error('INVALID_QUESTION_TYPE');
  if (!data.stem) throw new Error('STEM_REQUIRED');
  if (!Number.isFinite(data.defaultPoints) || data.defaultPoints <= 0 || data.defaultPoints > env.question.maxPoints) {
    throw new Error('INVALID_POINTS');
  }
  if (data.questionType === 'FILL_BLANK' && !data.correctAnswer) throw new Error('CORRECT_ANSWER_REQUIRED');
  if (data.questionType === 'TRUE_FALSE' && !['A', 'B'].includes(data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  if (data.questionType === 'MULTIPLE_CHOICE') {
    const filled = Object.entries(data.options || {}).filter(([, text]) => clean(text));
    if (filled.length < 2) throw new Error('OPTIONS_REQUIRED');
    if (!filled.some(([key]) => key === data.correctOption)) throw new Error('CORRECT_OPTION_REQUIRED');
  }
  return data;
}

function parse(body) {
  const questionType = TYPES.includes(body.questionType) ? body.questionType : 'MULTIPLE_CHOICE';
  const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : 'MEDIUM';
  return validateData({
    gradeId: body.gradeId ? Number(body.gradeId) : null,
    lessonId: body.lessonId ? Number(body.lessonId) : null,
    questionType,
    stem: clean(body.stem),
    correctAnswer: clean(questionType === 'ESSAY' ? body.essayModelAnswer : body.correctAnswer),
    explanation: clean(body.explanation),
    difficulty,
    defaultPoints: Number(body.defaultPoints || env.question.defaultPoints),
    correctOption: clean(body.correctOption),
    options: {
      A: clean(body.optionA),
      B: clean(body.optionB),
      C: clean(body.optionC),
      D: clean(body.optionD),
    },
  });
}

async function getAccessibleLessons(userId, isAdmin = false) {
  const lessons = await repo.findLessons();
  if (isAdmin || !userId) return lessons;
  const classes = await classService.getClasses(userId, false);
  const allowedClassIds = new Set(classes.map((item) => Number(item.id)));
  return lessons.filter((lesson) => allowedClassIds.has(Number(lesson.classId)));
}

async function canAccess(question, userId, isAdmin = false, accessibleLessonIds = null) {
  if (!question) return false;
  if (isAdmin || Number(question.createdBy) === Number(userId)) return true;
  if (!question.lessonId) return false;
  const allowedLessonIds = accessibleLessonIds || new Set((await getAccessibleLessons(userId, false)).map((item) => Number(item.id)));
  return allowedLessonIds.has(Number(question.lessonId));
}

async function ensureLessonAccess(lessonId, userId, isAdmin = false) {
  if (!lessonId) return;
  const lessons = await getAccessibleLessons(userId, isAdmin);
  if (!lessons.some((lesson) => Number(lesson.id) === Number(lessonId))) throw new Error('INVALID_LESSON');
}

async function list(filters, userId, isAdmin = false) {
  const [all, grades, accessibleLessons] = await Promise.all([
    repo.findAll(filters),
    repo.findGrades(),
    getAccessibleLessons(userId, isAdmin),
  ]);
  const accessibleLessonIds = new Set(accessibleLessons.map((item) => Number(item.id)));
  const questions = [];
  for (const question of all) {
    if (await canAccess(question, userId, isAdmin, accessibleLessonIds)) questions.push(question);
  }
  return { questions, grades, filters };
}

async function form(id = null, userId, isAdmin = false) {
  const [grades, lessons, rawQuestion] = await Promise.all([
    repo.findGrades(),
    getAccessibleLessons(userId, isAdmin),
    id ? repo.findById(id) : Promise.resolve(null),
  ]);
  const accessibleLessonIds = new Set(lessons.map((item) => Number(item.id)));
  const question = rawQuestion && await canAccess(rawQuestion, userId, isAdmin, accessibleLessonIds)
    ? rawQuestion
    : null;
  return { grades, lessons, question };
}

async function create(body, userId, isAdmin = false) {
  const data = parse(body);
  await ensureLessonAccess(data.lessonId, userId, isAdmin);
  return repo.create(data, userId);
}

async function update(id, body, userId, isAdmin = false) {
  const existing = await repo.findById(id);
  if (!await canAccess(existing, userId, isAdmin)) throw new Error('QUESTION_NOT_FOUND');
  const data = parse(body);
  await ensureLessonAccess(data.lessonId, userId, isAdmin);
  return repo.update(id, data, userId, isAdmin);
}

async function publish(id, userId, isAdmin = false) {
  const question = await repo.findById(id);
  if (!await canAccess(question, userId, isAdmin)) throw new Error('QUESTION_NOT_FOUND');
  if (['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(question.questionType) && !question.options.some((option) => option.isCorrect)) {
    throw new Error('QUESTION_NO_CORRECT_ANSWER');
  }
  if (question.questionType === 'FILL_BLANK' && !clean(question.correctAnswer)) throw new Error('QUESTION_NO_CORRECT_ANSWER');
  return repo.publish(id, userId, isAdmin);
}

function importError(rowNo, message) {
  return { rowNo, message };
}

function humanImportError(code) {
  const map = {
    INVALID_ACTION: 'Hành động chỉ nhận CREATE hoặc UPDATE.',
    UPDATE_ID_REQUIRED: 'Muốn cập nhật cần nhập Mã câu hỏi (ID).',
    QUESTION_NOT_FOUND: 'Không tìm thấy hoặc không có quyền cập nhật Mã câu hỏi này.',
    INVALID_GRADE: 'Khối chỉ nhận 6, 7, 8, 9 hoặc để trống.',
    INVALID_LESSON: 'Bài học liên quan không tồn tại hoặc không thuộc lớp bạn quản lý.',
    INVALID_QUESTION_TYPE: 'Loại câu hỏi không hợp lệ. Hãy chọn Trắc nghiệm, Đúng/Sai, Điền từ hoặc Tự luận.',
    STEM_REQUIRED: 'Thiếu Nội dung câu hỏi.',
    INVALID_POINTS: `Điểm phải > 0 và <= ${env.question.maxPoints}.`,
    CORRECT_ANSWER_REQUIRED: 'Câu Điền từ cần nhập Đáp án / Gợi ý.',
    CORRECT_OPTION_REQUIRED: 'Đáp án đúng không hợp lệ. Trắc nghiệm dùng A/B/C/D; Đúng/Sai dùng Đúng hoặc Sai.',
    OPTIONS_REQUIRED: 'Câu Trắc nghiệm cần ít nhất 2 đáp án lựa chọn.',
    INVALID_STATUS: 'Trạng thái chỉ nhận DRAFT hoặc PUBLISHED.',
  };
  return map[code] || code;
}

async function prepareImportRows(rawRows, userId, isAdmin = false) {
  const [grades, lessons] = await Promise.all([
    repo.findGrades(),
    getAccessibleLessons(userId, isAdmin),
  ]);
  const gradeMap = new Map(grades.map((grade) => [Number(grade.gradeNo), Number(grade.id)]));
  const lessonIds = new Set(lessons.map((lesson) => Number(lesson.id)));
  const updateIds = rawRows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  const existingIds = await repo.findExistingIds(updateIds, userId, isAdmin);
  const errors = [];
  const items = [];

  for (const row of rawRows) {
    try {
      const present = row._present || {};
      const id = Number(row.id || 0);
      let action = clean(row.action).toUpperCase();
      if (!action) action = id ? 'UPDATE' : 'CREATE';
      if (!['CREATE', 'UPDATE'].includes(action)) throw new Error('INVALID_ACTION');
      if (action === 'UPDATE' && (!Number.isInteger(id) || id <= 0)) throw new Error('UPDATE_ID_REQUIRED');
      if (action === 'UPDATE' && !existingIds.has(id)) throw new Error('QUESTION_NOT_FOUND');

      let gradeId = null;
      if (clean(row.grade)) {
        const grade = Number(row.grade);
        if (![6, 7, 8, 9].includes(grade) || !gradeMap.has(grade)) throw new Error('INVALID_GRADE');
        gradeId = gradeMap.get(grade);
      }

      let lessonId = null;
      if (present.lessonId && clean(row.lessonId)) {
        lessonId = Number(row.lessonId);
        if (!Number.isInteger(lessonId) || !lessonIds.has(lessonId)) throw new Error('INVALID_LESSON');
      }

      const questionType = normalizeType(row.questionType);
      const difficulty = present.difficulty ? normalizeDifficulty(row.difficulty) : (action === 'CREATE' ? 'MEDIUM' : null);
      const statusText = clean(row.status);
      if (present.status && statusText && !STATUSES.includes(token(statusText))) throw new Error('INVALID_STATUS');
      const status = present.status
        ? (statusText ? normalizeStatus(statusText) : (action === 'UPDATE' ? null : 'DRAFT'))
        : (action === 'CREATE' ? 'DRAFT' : null);

      const combinedAnswer = clean(row.answer);
      const correctOption = normalizeCorrectOption(clean(row.correctOption) || combinedAnswer, questionType);
      const correctAnswer = clean(row.correctAnswer) || (['FILL_BLANK', 'ESSAY'].includes(questionType) ? combinedAnswer : '');
      const defaultPoints = Number(clean(row.points) || env.question.defaultPoints);

      const data = validateData({
        action,
        id: action === 'UPDATE' ? id : null,
        gradeId,
        lessonId,
        questionType,
        stem: clean(row.stem),
        correctAnswer,
        explanation: clean(row.explanation),
        difficulty: difficulty || 'MEDIUM',
        defaultPoints,
        correctOption,
        options: {
          A: clean(row.optionA), B: clean(row.optionB), C: clean(row.optionC), D: clean(row.optionD),
        },
        status,
        _hasLessonColumn: Boolean(present.lessonId),
        _hasDifficultyColumn: Boolean(present.difficulty),
      });
      if (action === 'UPDATE' && !present.difficulty) data.difficulty = null;
      items.push(data);
    } catch (error) {
      errors.push(importError(row.rowNo, humanImportError(error.message)));
    }
  }
  return { items, errors };
}

async function importQuestions(file, userId, isAdmin = false) {
  const rawRows = await parseQuestionFile(file, env.question.importMaxRows);
  const { items, errors } = await prepareImportRows(rawRows, userId, isAdmin);
  if (errors.length) return { ok: false, totalRows: rawRows.length, errors, created: 0, updated: 0 };
  const result = await repo.bulkUpsert(items, userId, isAdmin);
  return { ok: true, totalRows: rawRows.length, errors: [], ...result };
}

async function template() {
  return buildTemplateBuffer();
}

module.exports = { list, form, create, update, publish, importQuestions, template };
