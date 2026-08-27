const env = require('../../config/env');
const repo = require('./exam.repository');
const questionService = require('../questions/question.service');
const classService = require('../classes/class.service');
const skillRepo = require('../skills/skill.repository');

async function canAccess(exam, userId, isAdmin) {
  return Boolean(exam && (isAdmin || await classService.getClassDetail(exam.classId, userId, false)));
}

function clean(value) { return String(value ?? '').trim(); }
function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  const list = Array.isArray(value) ? value : [value];
  return list.some((v) => ['on', 'true', '1', 'yes'].includes(String(v).toLowerCase()));
}
function dateValue(value) {
  const text = clean(value); if (!text) return '';
  const date = new Date(text); if (Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  return date.toISOString();
}
function ids(value) {
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(Number).filter((x) => Number.isInteger(x) && x > 0))];
}
function array(value) { return Array.isArray(value) ? value : (value == null ? [] : [value]); }
function shuffle(values) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function parsePoolRules(body) {
  const skills = array(body.poolSkill), difficulties = array(body.poolDifficulty), types = array(body.poolQuestionType), counts = array(body.poolCount);
  const n = Math.max(skills.length, difficulties.length, types.length, counts.length);
  const validSkills = new Set(skillRepo.CATALOG.map((x) => x.code));
  const validDifficulty = new Set(['', 'EASY', 'MEDIUM', 'HARD']);
  const validType = new Set(['', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'ESSAY']);
  const rules = [];
  for (let i = 0; i < n; i += 1) {
    const skillCode = clean(skills[i]).toUpperCase();
    const difficulty = clean(difficulties[i]).toUpperCase();
    const questionType = clean(types[i]).toUpperCase();
    const questionCount = Number(counts[i] || 0);
    if (!skillCode && !difficulty && !questionType && !questionCount) continue;
    if (skillCode && !validSkills.has(skillCode)) throw new Error('INVALID_POOL_RULE');
    if (!validDifficulty.has(difficulty) || !validType.has(questionType)) throw new Error('INVALID_POOL_RULE');
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) throw new Error('INVALID_POOL_RULE');
    rules.push({ skillCode: skillCode || null, difficulty: difficulty || null, questionType: questionType || null, questionCount });
  }
  return rules;
}

function parseExam(body) {
  const classId = Number(body.classId), title = clean(body.title);
  const durationMinutes = Number(body.durationMinutes || env.exam.defaultDurationMinutes);
  const maxAttempts = Number(body.maxAttempts || env.exam.defaultMaxAttempts);
  const selectionMode = clean(body.selectionMode).toUpperCase() === 'POOL' ? 'POOL' : 'MANUAL';
  const questionIds = ids(body.questionIds);
  const poolRules = parsePoolRules(body);
  const passScorePercent = Number(body.passScorePercent ?? 50);
  if (!Number.isInteger(classId) || classId <= 0) throw new Error('CLASS_REQUIRED');
  if (!title) throw new Error('TITLE_REQUIRED');
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > env.exam.maxDurationMinutes) throw new Error('INVALID_DURATION');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > env.exam.maxAttempts) throw new Error('INVALID_ATTEMPTS');
  if (!Number.isFinite(passScorePercent) || passScorePercent < 0 || passScorePercent > 100) throw new Error('INVALID_PASS_SCORE');
  if (selectionMode === 'MANUAL' && !questionIds.length) throw new Error('QUESTIONS_REQUIRED');
  if (selectionMode === 'POOL' && !poolRules.length) throw new Error('POOL_RULES_REQUIRED');
  const startAt = dateValue(body.startAt), endAt = dateValue(body.endAt);
  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) throw new Error('INVALID_WINDOW');
  return {
    classId, title, description: clean(body.description), instructions: clean(body.instructions), durationMinutes, startAt, endAt, maxAttempts,
    showResult: bool(body.showResult, env.exam.defaultShowResult), selectionMode,
    randomizeQuestions: bool(body.randomizeQuestions), randomizeOptions: bool(body.randomizeOptions), passScorePercent,
    questionIds, poolRules,
  };
}

async function list(userId, isAdmin = false) {
  const classes = isAdmin ? await repo.findClasses() : await classService.getClasses(userId, false);
  const allowed = new Set(classes.map((c) => Number(c.id)));
  return { exams: (await repo.findAll()).filter((e) => isAdmin || allowed.has(Number(e.classId))) };
}

async function newForm(id = null, userId, isAdmin = false) {
  const [classes, questionData, skills] = await Promise.all([
    isAdmin ? repo.findClasses() : classService.getClasses(userId, false),
    questionService.list({ status: 'PUBLISHED' }, userId, isAdmin),
    skillRepo.findSkills(),
  ]);
  const exam = id ? await repo.findById(id) : null;
  return { classes, questions: questionData.questions, skills, exam: await canAccess(exam, userId, isAdmin) ? exam : null };
}

async function materializePoolQuestions(data, userId, isAdmin) {
  if (data.selectionMode !== 'POOL') return data;
  const classItem = await classService.getClassDetail(data.classId, userId, isAdmin);
  if (!classItem) throw new Error('CLASS_NOT_FOUND');
  const questionData = await questionService.list({ status: 'PUBLISHED' }, userId, isAdmin);
  const candidates = [];
  for (const q of questionData.questions) {
    if (q.grade && Number(q.grade) !== Number(classItem.grade)) continue;
    candidates.push({ ...q, skillCodes: await skillRepo.getQuestionSkills(q.id) });
  }
  const used = new Set(); const selected = [];
  for (const rule of data.poolRules) {
    const matches = shuffle(candidates.filter((q) => !used.has(Number(q.id))
      && (!rule.skillCode || q.skillCodes.includes(rule.skillCode))
      && (!rule.difficulty || q.difficulty === rule.difficulty)
      && (!rule.questionType || q.questionType === rule.questionType)));
    if (matches.length < rule.questionCount) throw new Error('POOL_NOT_ENOUGH_QUESTIONS');
    matches.slice(0, rule.questionCount).forEach((q) => { used.add(Number(q.id)); selected.push(Number(q.id)); });
  }
  if (!selected.length) throw new Error('QUESTIONS_REQUIRED');
  return { ...data, questionIds: selected };
}

async function validateManualQuestions(data, userId, isAdmin) {
  if (data.selectionMode !== 'MANUAL') return data;
  const questions = (await questionService.list({ status: 'PUBLISHED' }, userId, isAdmin)).questions;
  const allowed = new Set(questions.map((q) => Number(q.id)));
  if (data.questionIds.some((id) => !allowed.has(Number(id)))) throw new Error('INVALID_QUESTIONS');
  return data;
}

async function create(body, userId, isAdmin = false) {
  let data = parseExam(body);
  if (!await classService.getClassDetail(data.classId, userId, isAdmin)) throw new Error('CLASS_NOT_FOUND');
  data = await validateManualQuestions(data, userId, isAdmin);
  data = await materializePoolQuestions(data, userId, isAdmin);
  return repo.create(data, userId);
}

async function update(id, body, userId, isAdmin = false) {
  if (!await detail(id, userId, isAdmin)) throw new Error('EXAM_NOT_FOUND');
  let data = parseExam(body);
  if (!await classService.getClassDetail(data.classId, userId, isAdmin)) throw new Error('CLASS_NOT_FOUND');
  data = await validateManualQuestions(data, userId, isAdmin);
  data = await materializePoolQuestions(data, userId, isAdmin);
  return repo.update(id, data);
}

async function detail(id, userId, isAdmin = false) {
  const exam = await repo.findById(id);
  return await canAccess(exam, userId, isAdmin) ? exam : null;
}

async function publish(id, userId, isAdmin = false) {
  const exam = await detail(id, userId, isAdmin); if (!exam) throw new Error('EXAM_NOT_FOUND');
  if (!exam.questions.length) throw new Error('EXAM_EMPTY');
  return repo.publish(id);
}
async function close(id, userId, isAdmin = false) { if (!await detail(id, userId, isAdmin)) throw new Error('EXAM_NOT_FOUND'); return repo.close(id); }
async function duplicate(id, userId, isAdmin = false) { if (!await detail(id, userId, isAdmin)) throw new Error('EXAM_NOT_FOUND'); return repo.duplicate(id, userId); }

async function saveOverride(examId, body, userId, isAdmin = false) {
  if (!await detail(examId, userId, isAdmin)) throw new Error('EXAM_NOT_FOUND');
  const studentId = Number(body.studentId), extraMinutes = Number(body.extraMinutes || 0);
  const maxAttemptsOverride = clean(body.maxAttemptsOverride) ? Number(body.maxAttemptsOverride) : null;
  if (!Number.isInteger(studentId) || studentId <= 0) throw new Error('INVALID_OVERRIDE');
  if (!Number.isInteger(extraMinutes) || extraMinutes < 0 || extraMinutes > 1440) throw new Error('INVALID_OVERRIDE');
  if (maxAttemptsOverride != null && (!Number.isInteger(maxAttemptsOverride) || maxAttemptsOverride < 1 || maxAttemptsOverride > 20)) throw new Error('INVALID_OVERRIDE');
  const reopenUntil = dateValue(body.reopenUntil);
  return repo.saveStudentOverride(examId, studentId, { extraMinutes, maxAttemptsOverride, reopenUntil });
}

async function studentList(userId) {
  const exams = await repo.findStudentExams(userId); const now = Date.now();
  return exams.map((e) => {
    const start = e.startAt ? new Date(e.startAt).getTime() : null, end = e.endAt ? new Date(e.endAt).getTime() : null, reopen = e.reopenUntil ? new Date(e.reopenUntil).getTime() : null;
    let availability = e.status === 'CLOSED' && !(reopen && now <= reopen) ? 'CLOSED' : 'OPEN';
    if (availability !== 'CLOSED' && start && now < start) availability = 'UPCOMING';
    if (availability !== 'CLOSED' && end && now > end && !(reopen && now <= reopen)) availability = 'CLOSED';
    if (Number(e.attempts || 0) >= Number(e.effectiveMaxAttempts || e.maxAttempts || 1) && e.lastStatus !== 'IN_PROGRESS') availability = 'DONE';
    return { ...e, maxAttempts: Number(e.effectiveMaxAttempts || e.maxAttempts), availability };
  });
}

async function start(id, userId) { return repo.startAttempt(id, userId); }
async function attempt(id, userId) {
  const data = await repo.findAttempt(id, userId); if (!data) return null;
  const map = new Map(data.answers.map((a) => [Number(a.questionId), a]));
  data.exam.questions = data.exam.questions.map((q) => ({ ...q, answer: map.get(Number(q.id)) || { selectedOptionId: null, selectedOptionKey: null, answerText: '', gradingStatus: 'NOT_GRADED', teacherFeedback: '', awardedScore: null } }));
  data.remainingMs = Math.max(0, new Date(data.deadline).getTime() - Date.now());
  if (data.status !== 'IN_PROGRESS' && data.score != null && data.maxScore > 0) data.passed = Number(data.score) / Number(data.maxScore) * 100 >= Number(data.exam.passScorePercent || 50);
  return data;
}
async function saveAnswer(attemptId, userId, body) { return repo.saveAnswer(attemptId, userId, { questionId: Number(body.questionId), selectedOptionKey: clean(body.selectedOptionKey || body.selectedOptionId), answerText: clean(body.answerText) }); }

async function submit(attemptId, userId, body) {
  const data = await repo.findAttempt(attemptId, userId); if (!data) throw new Error('ATTEMPT_NOT_FOUND');
  const expired = Date.now() > new Date(data.deadline).getTime(); let auto = body.autoSubmitted === '1' || expired;
  if (!expired) {
    try {
      for (const q of data.exam.questions) {
        const raw = body[`answer_${q.id}`];
        if (['FILL_BLANK', 'ESSAY'].includes(q.questionType)) await repo.saveAnswer(attemptId, userId, { questionId: q.id, answerText: clean(raw), selectedOptionKey: null });
        else if (raw) await repo.saveAnswer(attemptId, userId, { questionId: q.id, selectedOptionKey: clean(raw), answerText: '' });
      }
    } catch (error) {
      if (error.message === 'ATTEMPT_NOT_ACTIVE' || error.message === 'ATTEMPT_EXPIRED') auto = true; else throw error;
    }
  }
  const result = await repo.gradeAttempt(attemptId, userId, auto);
  if (['GRADED', 'AUTO_SUBMITTED'].includes(result.status)) await skillRepo.recordExamAttempt(attemptId);
  return result;
}

async function gradeForm(examId, attemptId, userId, isAdmin = false) {
  const exam = await detail(examId, userId, isAdmin); if (!exam) return null;
  const data = await repo.findAttemptForTeacher(examId, attemptId); if (!data) return null;
  data.essayQuestions = data.exam.questions.filter((q) => q.questionType === 'ESSAY'); return data;
}
async function manualGrade(examId, attemptId, userId, body, isAdmin = false) {
  const data = await gradeForm(examId, attemptId, userId, isAdmin); if (!data) throw new Error('ATTEMPT_NOT_FOUND');
  const grades = data.exam.questions.filter((q) => q.questionType === 'ESSAY').map((q) => ({ questionId: q.id, awardedScore: body[`score_${q.id}`], teacherFeedback: clean(body[`feedback_${q.id}`]) }));
  const result = await repo.manualGradeAttempt(examId, attemptId, userId, grades); await skillRepo.recordExamAttempt(attemptId); return result;
}

module.exports = { list, newForm, create, update, detail, publish, close, duplicate, saveOverride, studentList, start, attempt, saveAnswer, submit, gradeForm, manualGrade };
