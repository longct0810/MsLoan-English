const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function idOf(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function demoStudentId(userId) {
  return (demoStore.studentAccounts || []).find((x) => x.userId === Number(userId))?.studentId || null;
}

function shuffle(values) {
  const list = [...values];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function demoLiveQuestions(examId) {
  return (demoStore.examQuestions || [])
    .filter((x) => Number(x.examId) === Number(examId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((link) => {
      const q = (demoStore.questions || []).find((x) => Number(x.id) === Number(link.questionId));
      if (!q) return null;
      return {
        ...q,
        points: Number(link.points || q.defaultPoints || 1),
        sortOrder: link.sortOrder,
        skillCodes: (demoStore.questionSkills || []).filter((x) => Number(x.questionId) === Number(q.id)).map((x) => x.skillCode),
        options: (demoStore.questionOptions || []).filter((o) => Number(o.questionId) === Number(q.id)).sort((a, b) => a.sortOrder - b.sortOrder),
      };
    })
    .filter(Boolean);
}

function demoSnapshotQuestions(examId) {
  return (demoStore.examQuestionSnapshots || [])
    .filter((x) => Number(x.examId) === Number(examId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options.map((o) => ({ ...o })) : [] }));
}

async function findClasses() {
  if (env.demo.enabled) return demoStore.classes.filter((c) => c.status !== 'DELETED').map((c) => ({ id: c.id, name: c.name, grade: c.grade, gradeId: c.grade }));
  const { rows } = await pool.query(`
    SELECT c.id,c.name,c.grade_id AS "gradeId",g.grade_no AS grade
      FROM classes c JOIN grades g ON g.id=c.grade_id
     WHERE c.status='ACTIVE' AND c.deleted_at IS NULL
     ORDER BY g.grade_no,c.name
  `);
  return rows;
}

async function findAll() {
  if (env.demo.enabled) {
    return (demoStore.exams || []).map((exam) => {
      const c = demoStore.classes.find((x) => x.id === exam.classId);
      const attempts = (demoStore.examAttempts || []).filter((a) => a.examId === exam.id && a.status !== 'IN_PROGRESS');
      const questions = (exam.status === 'DRAFT' ? demoLiveQuestions(exam.id) : demoSnapshotQuestions(exam.id));
      const q = questions.length ? questions : demoLiveQuestions(exam.id);
      const finalScores = attempts.filter((a) => a.score != null).map((a) => Number(a.score)).filter(Number.isFinite);
      return {
        ...exam,
        className: c?.name || '',
        grade: c?.grade || null,
        questionCount: q.length,
        totalPoints: q.reduce((sum, x) => sum + Number(x.points || 1), 0),
        submitted: attempts.length,
        pendingGrading: attempts.filter((a) => a.status === 'PENDING_GRADING').length,
        averageScore: finalScores.length ? finalScores.reduce((sum, x) => sum + x, 0) / finalScores.length : null,
      };
    }).sort((a, b) => b.id - a.id);
  }

  const { rows } = await pool.query(`
    SELECT e.id,e.class_id AS "classId",e.title,e.description,e.duration_minutes AS "durationMinutes",
           e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,
           e.selection_mode AS "selectionMode",e.randomize_questions AS "randomizeQuestions",e.randomize_options AS "randomizeOptions",
           e.pass_score_percent::float AS "passScorePercent",
           c.name AS "className",g.grade_no AS grade,
           CASE WHEN e.status='DRAFT'
                THEN (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id=e.id)
                ELSE COALESCE((SELECT COUNT(*)::int FROM exam_question_snapshots s WHERE s.exam_id=e.id),(SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id=e.id)) END AS "questionCount",
           CASE WHEN e.status='DRAFT'
                THEN COALESCE((SELECT SUM(eq.points)::float FROM exam_questions eq WHERE eq.exam_id=e.id),0)
                ELSE COALESCE((SELECT SUM(s.points)::float FROM exam_question_snapshots s WHERE s.exam_id=e.id),(SELECT SUM(eq.points)::float FROM exam_questions eq WHERE eq.exam_id=e.id),0) END AS "totalPoints",
           (SELECT COUNT(*)::int FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.status<>'IN_PROGRESS') AS submitted,
           (SELECT COUNT(*)::int FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.status='PENDING_GRADING') AS "pendingGrading",
           (SELECT AVG(ea.score)::float FROM exam_attempts ea WHERE ea.exam_id=e.id AND ea.status IN ('GRADED','AUTO_SUBMITTED') AND ea.score IS NOT NULL) AS "averageScore"
      FROM exams e JOIN classes c ON c.id=e.class_id JOIN grades g ON g.id=c.grade_id
     ORDER BY e.id DESC
  `);
  return rows;
}

async function loadLiveQuestions(examId) {
  const { rows } = await pool.query(`
    SELECT q.id,q.question_type AS "questionType",q.stem,q.correct_answer AS "correctAnswer",q.explanation,q.difficulty,
           eq.sort_order AS "sortOrder",eq.points::float AS points,g.grade_no AS grade,l.title AS "lessonTitle",
           COALESCE((SELECT jsonb_agg(qs.skill_code ORDER BY qs.skill_code) FROM question_skills qs WHERE qs.question_id=q.id),'[]'::jsonb) AS "skillCodes"
      FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
      LEFT JOIN grades g ON g.id=q.grade_id LEFT JOIN lessons l ON l.id=q.lesson_id
     WHERE eq.exam_id=$1 ORDER BY eq.sort_order,q.id
  `, [examId]);
  for (const q of rows) {
    const opts = await pool.query(`SELECT id,option_key AS "optionKey",option_text AS "optionText",is_correct AS "isCorrect",sort_order AS "sortOrder" FROM question_options WHERE question_id=$1 ORDER BY sort_order,id`, [q.id]);
    q.options = opts.rows;
  }
  return rows;
}

async function loadSnapshotQuestions(examId) {
  const { rows } = await pool.query(`
    SELECT question_id AS id,question_type AS "questionType",stem,correct_answer AS "correctAnswer",explanation,difficulty,
           points::float,sort_order AS "sortOrder",options,skill_codes AS "skillCodes"
      FROM exam_question_snapshots WHERE exam_id=$1 ORDER BY sort_order,question_id
  `, [examId]);
  return rows.map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : [], skillCodes: Array.isArray(q.skillCodes) ? q.skillCodes : [] }));
}

async function findById(value) {
  const id = idOf(value);
  if (!id) return null;
  if (env.demo.enabled) {
    const exam = (demoStore.exams || []).find((x) => x.id === id);
    if (!exam) return null;
    const c = demoStore.classes.find((x) => x.id === exam.classId);
    let questions = exam.status === 'DRAFT' ? demoLiveQuestions(id) : demoSnapshotQuestions(id);
    if (!questions.length) questions = demoLiveQuestions(id);
    const attempts = (demoStore.examAttempts || []).filter((a) => a.examId === id).map((a) => ({ ...a, studentName: demoStore.students.find((s) => s.id === a.studentId)?.fullName || '' }));
    const completed = attempts.filter((a) => a.status !== 'IN_PROGRESS');
    questions.forEach((q) => {
      if (q.questionType === 'ESSAY') { q.answeredCount = null; q.correctCount = null; q.accuracy = null; return; }
      const answers = (demoStore.examAnswers || []).filter((ans) => ans.questionId === q.id && completed.some((a) => a.id === ans.attemptId));
      const correct = answers.filter((ans) => ans.isCorrect === true).length;
      q.answeredCount = answers.length; q.correctCount = correct; q.accuracy = answers.length ? Math.round(correct * 100 / answers.length) : null;
    });
    const scores = completed.filter((a) => a.score != null).map((a) => Number(a.score)).filter(Number.isFinite);
    const analytics = { submitted: completed.length, pendingGrading: completed.filter((a) => a.status === 'PENDING_GRADING').length, averageScore: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null, highestScore: scores.length ? Math.max(...scores) : null };
    const poolRules = (demoStore.examPoolRules || []).filter((r) => Number(r.examId) === id).sort((a, b) => a.sortOrder - b.sortOrder);
    const overrides = (demoStore.examStudentOverrides || []).filter((r) => Number(r.examId) === id);
    const classStudents = demoStore.students.filter((s) => (s.classIds || []).includes(exam.classId)).map((s) => ({ id: s.id, fullName: s.fullName, override: overrides.find((o) => o.studentId === s.id) || null }));
    return { ...exam, className: c?.name || '', grade: c?.grade || null, questions, attempts, analytics, poolRules, classStudents, totalPoints: questions.reduce((sum, q) => sum + Number(q.points || 1), 0), hasEssay: questions.some((q) => q.questionType === 'ESSAY') };
  }

  const examRes = await pool.query(`
    SELECT e.id,e.class_id AS "classId",e.title,e.description,e.instructions,e.duration_minutes AS "durationMinutes",
           e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,e.published_at AS "publishedAt",
           e.selection_mode AS "selectionMode",e.randomize_questions AS "randomizeQuestions",e.randomize_options AS "randomizeOptions",e.pass_score_percent::float AS "passScorePercent",
           c.name AS "className",g.grade_no AS grade,c.grade_id AS "gradeId"
      FROM exams e JOIN classes c ON c.id=e.class_id JOIN grades g ON g.id=c.grade_id WHERE e.id=$1
  `, [id]);
  if (!examRes.rows[0]) return null;
  const exam = examRes.rows[0];
  let questions = exam.status === 'DRAFT' ? await loadLiveQuestions(id) : await loadSnapshotQuestions(id);
  if (!questions.length) questions = await loadLiveQuestions(id);

  const attemptsRes = await pool.query(`
    SELECT ea.id,ea.student_id AS "studentId",s.full_name AS "studentName",ea.attempt_no AS "attemptNo",ea.status,
           ea.started_at AS "startedAt",ea.submitted_at AS "submittedAt",ea.score::float,ea.auto_score::float AS "autoScore",ea.max_score::float AS "maxScore",
           ea.effective_duration_minutes AS "effectiveDurationMinutes"
      FROM exam_attempts ea JOIN students s ON s.id=ea.student_id WHERE ea.exam_id=$1 ORDER BY ea.started_at DESC
  `, [id]);
  const accuracy = await pool.query(`
    SELECT s.question_id AS "questionId",COUNT(ans.attempt_id)::int AS "answeredCount",
           COUNT(ans.attempt_id) FILTER(WHERE ans.is_correct=TRUE)::int AS "correctCount"
      FROM exam_question_snapshots s
      LEFT JOIN exam_attempts ea ON ea.exam_id=s.exam_id AND ea.status<>'IN_PROGRESS'
      LEFT JOIN exam_answers ans ON ans.attempt_id=ea.id AND ans.question_id=s.question_id
     WHERE s.exam_id=$1 AND s.question_type<>'ESSAY' GROUP BY s.question_id
  `, [id]);
  const accuracyMap = new Map(accuracy.rows.map((r) => [Number(r.questionId), r]));
  questions.forEach((q) => {
    if (q.questionType === 'ESSAY') { q.answeredCount = null; q.correctCount = null; q.accuracy = null; return; }
    const a = accuracyMap.get(Number(q.id)) || { answeredCount: 0, correctCount: 0 };
    q.answeredCount = a.answeredCount; q.correctCount = a.correctCount; q.accuracy = a.answeredCount ? Math.round(a.correctCount * 100 / a.answeredCount) : null;
  });
  const completed = attemptsRes.rows.filter((a) => a.status !== 'IN_PROGRESS');
  const scores = completed.filter((a) => a.score != null).map((a) => Number(a.score)).filter(Number.isFinite);
  const analytics = { submitted: completed.length, pendingGrading: completed.filter((a) => a.status === 'PENDING_GRADING').length, averageScore: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null, highestScore: scores.length ? Math.max(...scores) : null };
  const poolRulesRes = await pool.query(`SELECT id,skill_code AS "skillCode",difficulty,question_type AS "questionType",question_count AS "questionCount",sort_order AS "sortOrder" FROM exam_pool_rules WHERE exam_id=$1 ORDER BY sort_order,id`, [id]);
  const studentsRes = await pool.query(`
    SELECT s.id,s.full_name AS "fullName",o.extra_minutes AS "extraMinutes",o.max_attempts_override AS "maxAttemptsOverride",o.reopen_until AS "reopenUntil",o.is_enabled AS "overrideEnabled"
      FROM class_students cs JOIN students s ON s.id=cs.student_id AND s.deleted_at IS NULL
      LEFT JOIN exam_student_overrides o ON o.exam_id=$2 AND o.student_id=s.id
     WHERE cs.class_id=$1 AND cs.status='ACTIVE' ORDER BY s.full_name
  `, [exam.classId, id]);
  const classStudents = studentsRes.rows.map((s) => ({ ...s, override: s.extraMinutes != null || s.maxAttemptsOverride != null || s.reopenUntil ? { extraMinutes: Number(s.extraMinutes || 0), maxAttemptsOverride: s.maxAttemptsOverride == null ? null : Number(s.maxAttemptsOverride), reopenUntil: s.reopenUntil, isEnabled: s.overrideEnabled !== false } : null }));
  return { ...exam, questions, attempts: attemptsRes.rows, analytics, poolRules: poolRulesRes.rows, classStudents, totalPoints: questions.reduce((sum, q) => sum + Number(q.points || 0), 0), hasEssay: questions.some((q) => q.questionType === 'ESSAY') };
}

async function savePoolRules(client, examId, rules) {
  await client.query(`DELETE FROM exam_pool_rules WHERE exam_id=$1`, [examId]);
  for (let i = 0; i < (rules || []).length; i += 1) {
    const r = rules[i];
    await client.query(`INSERT INTO exam_pool_rules(exam_id,skill_code,difficulty,question_type,question_count,sort_order) VALUES($1,NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),$5,$6)`, [examId, r.skillCode || '', r.difficulty || '', r.questionType || '', r.questionCount, i + 1]);
  }
}

async function saveExamQuestions(client, examId, data) {
  const classRes = await client.query(`SELECT grade_id FROM classes WHERE id=$1 AND status='ACTIVE' AND deleted_at IS NULL`, [data.classId]);
  if (!classRes.rows[0]) throw new Error('CLASS_NOT_FOUND');
  const qRes = await client.query(`SELECT id,default_points FROM questions WHERE id=ANY($1::bigint[]) AND status='PUBLISHED' AND (grade_id IS NULL OR grade_id=$2)`, [data.questionIds, classRes.rows[0].grade_id]);
  if (qRes.rows.length !== data.questionIds.length) throw new Error('INVALID_QUESTIONS');
  await client.query(`DELETE FROM exam_questions WHERE exam_id=$1`, [examId]);
  const byId = new Map(qRes.rows.map((q) => [Number(q.id), Number(q.default_points)]));
  for (let i = 0; i < data.questionIds.length; i += 1) {
    await client.query(`INSERT INTO exam_questions(exam_id,question_id,sort_order,points) VALUES($1,$2,$3,$4)`, [examId, data.questionIds[i], i + 1, byId.get(data.questionIds[i]) || 1]);
  }
}

async function create(data, userId) {
  if (env.demo.enabled) {
    demoStore.exams = demoStore.exams || []; demoStore.examQuestions = demoStore.examQuestions || []; demoStore.examPoolRules = demoStore.examPoolRules || [];
    const id = Math.max(0, ...demoStore.exams.map((e) => e.id)) + 1;
    const exam = { id, classId: Number(data.classId), title: data.title, description: data.description, instructions: data.instructions, durationMinutes: data.durationMinutes, startAt: data.startAt || null, endAt: data.endAt || null, maxAttempts: data.maxAttempts, showResult: data.showResult, selectionMode: data.selectionMode, randomizeQuestions: data.randomizeQuestions, randomizeOptions: data.randomizeOptions, passScorePercent: data.passScorePercent, status: 'DRAFT', createdBy: Number(userId) };
    demoStore.exams.push(exam);
    data.questionIds.forEach((qid, index) => { const q = (demoStore.questions || []).find((x) => x.id === qid); if (q?.status === 'PUBLISHED') demoStore.examQuestions.push({ examId: id, questionId: qid, sortOrder: index + 1, points: Number(q.defaultPoints || 1) }); });
    (data.poolRules || []).forEach((r, index) => demoStore.examPoolRules.push({ id: demoStore.examPoolRules.length + 1, examId: id, ...r, sortOrder: index + 1 }));
    return findById(id);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO exams(class_id,title,description,instructions,duration_minutes,start_at,end_at,max_attempts,show_result,status,created_by,selection_mode,randomize_questions,randomize_options,pass_score_percent)
      VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),$5,NULLIF($6,'')::timestamptz,NULLIF($7,'')::timestamptz,$8,$9,'DRAFT',$10,$11,$12,$13,$14) RETURNING id
    `, [data.classId, data.title, data.description || '', data.instructions || '', data.durationMinutes, data.startAt || '', data.endAt || '', data.maxAttempts, data.showResult, userId, data.selectionMode, data.randomizeQuestions, data.randomizeOptions, data.passScorePercent]);
    await saveExamQuestions(client, rows[0].id, data);
    await savePoolRules(client, rows[0].id, data.poolRules);
    await client.query('COMMIT');
    return findById(rows[0].id);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function update(value, data) {
  const id = idOf(value); if (!id) throw new Error('EXAM_NOT_FOUND');
  if (env.demo.enabled) {
    const exam = (demoStore.exams || []).find((e) => e.id === id); if (!exam) throw new Error('EXAM_NOT_FOUND'); if (exam.status !== 'DRAFT') throw new Error('EXAM_NOT_EDITABLE');
    Object.assign(exam, { classId: Number(data.classId), title: data.title, description: data.description, instructions: data.instructions, durationMinutes: data.durationMinutes, startAt: data.startAt || null, endAt: data.endAt || null, maxAttempts: data.maxAttempts, showResult: data.showResult, selectionMode: data.selectionMode, randomizeQuestions: data.randomizeQuestions, randomizeOptions: data.randomizeOptions, passScorePercent: data.passScorePercent });
    demoStore.examQuestions = (demoStore.examQuestions || []).filter((x) => x.examId !== id);
    data.questionIds.forEach((qid, index) => { const q = (demoStore.questions || []).find((x) => x.id === qid && x.status === 'PUBLISHED'); if (q) demoStore.examQuestions.push({ examId: id, questionId: qid, sortOrder: index + 1, points: Number(q.defaultPoints || 1) }); });
    demoStore.examPoolRules = (demoStore.examPoolRules || []).filter((x) => x.examId !== id);
    (data.poolRules || []).forEach((r, index) => demoStore.examPoolRules.push({ id: demoStore.examPoolRules.length + 1, examId: id, ...r, sortOrder: index + 1 }));
    return findById(id);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(`SELECT status FROM exams WHERE id=$1 FOR UPDATE`, [id]);
    if (!existing.rows[0]) throw new Error('EXAM_NOT_FOUND');
    if (existing.rows[0].status !== 'DRAFT') throw new Error('EXAM_NOT_EDITABLE');
    await client.query(`UPDATE exams SET class_id=$2,title=$3,description=NULLIF($4,''),instructions=NULLIF($5,''),duration_minutes=$6,start_at=NULLIF($7,'')::timestamptz,end_at=NULLIF($8,'')::timestamptz,max_attempts=$9,show_result=$10,selection_mode=$11,randomize_questions=$12,randomize_options=$13,pass_score_percent=$14,updated_at=NOW() WHERE id=$1`, [id, data.classId, data.title, data.description || '', data.instructions || '', data.durationMinutes, data.startAt || '', data.endAt || '', data.maxAttempts, data.showResult, data.selectionMode, data.randomizeQuestions, data.randomizeOptions, data.passScorePercent]);
    await saveExamQuestions(client, id, data);
    await savePoolRules(client, id, data.poolRules);
    await client.query('COMMIT');
    return findById(id);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function publish(value) {
  const id = idOf(value); if (!id) throw new Error('EXAM_NOT_FOUND');
  if (env.demo.enabled) {
    const e = (demoStore.exams || []).find((x) => x.id === id); if (!e) throw new Error('EXAM_NOT_FOUND');
    const live = demoLiveQuestions(id); if (!live.length) throw new Error('EXAM_EMPTY_OR_NOT_FOUND');
    demoStore.examQuestionSnapshots = (demoStore.examQuestionSnapshots || []).filter((x) => x.examId !== id);
    live.forEach((q) => demoStore.examQuestionSnapshots.push({ examId: id, questionId: q.id, id: q.id, questionType: q.questionType, stem: q.stem, correctAnswer: q.correctAnswer || '', explanation: q.explanation || '', difficulty: q.difficulty, points: q.points, sortOrder: q.sortOrder, options: q.options.map((o) => ({ ...o })), skillCodes: [...(q.skillCodes || [])] }));
    e.status = 'PUBLISHED'; e.publishedAt = new Date().toISOString(); return e;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query(`SELECT status FROM exams WHERE id=$1 FOR UPDATE`, [id]);
    if (!lock.rows[0]) throw new Error('EXAM_NOT_FOUND');
    if (lock.rows[0].status !== 'DRAFT') throw new Error('EXAM_NOT_EDITABLE');
    const count = await client.query(`SELECT COUNT(*)::int AS n FROM exam_questions WHERE exam_id=$1`, [id]);
    if (!count.rows[0].n) throw new Error('EXAM_EMPTY_OR_NOT_FOUND');
    await client.query(`DELETE FROM exam_question_snapshots WHERE exam_id=$1`, [id]);
    await client.query(`
      INSERT INTO exam_question_snapshots(exam_id,question_id,question_type,stem,correct_answer,explanation,difficulty,points,sort_order,options,skill_codes)
      SELECT eq.exam_id,q.id,q.question_type,q.stem,q.correct_answer,q.explanation,q.difficulty,eq.points,eq.sort_order,
             COALESCE((SELECT jsonb_agg(jsonb_build_object('id',qo.id,'optionKey',qo.option_key,'optionText',qo.option_text,'isCorrect',qo.is_correct,'sortOrder',qo.sort_order) ORDER BY qo.sort_order,qo.id) FROM question_options qo WHERE qo.question_id=q.id),'[]'::jsonb),
             COALESCE((SELECT jsonb_agg(qs.skill_code ORDER BY qs.skill_code) FROM question_skills qs WHERE qs.question_id=q.id),'[]'::jsonb)
        FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1
    `, [id]);
    const { rows } = await client.query(`UPDATE exams SET status='PUBLISHED',published_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING id,status`, [id]);
    await client.query('COMMIT'); return rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function close(value) {
  const id = idOf(value); if (!id) throw new Error('EXAM_NOT_FOUND');
  if (env.demo.enabled) { const e = (demoStore.exams || []).find((x) => x.id === id); if (!e) throw new Error('EXAM_NOT_FOUND'); e.status = 'CLOSED'; return e; }
  const { rows } = await pool.query(`UPDATE exams SET status='CLOSED',updated_at=NOW() WHERE id=$1 RETURNING id,status`, [id]);
  if (!rows[0]) throw new Error('EXAM_NOT_FOUND'); return rows[0];
}

async function duplicate(value, userId) {
  const source = await findById(value); if (!source) throw new Error('EXAM_NOT_FOUND');
  return create({
    classId: source.classId,
    title: `${source.title} - Bản sao`,
    description: source.description || '', instructions: source.instructions || '', durationMinutes: source.durationMinutes,
    startAt: '', endAt: '', maxAttempts: source.maxAttempts, showResult: source.showResult,
    selectionMode: source.selectionMode || 'MANUAL', randomizeQuestions: Boolean(source.randomizeQuestions), randomizeOptions: Boolean(source.randomizeOptions),
    passScorePercent: Number(source.passScorePercent || 50), questionIds: source.questions.map((q) => Number(q.id)), poolRules: source.poolRules || [],
  }, userId);
}

async function saveStudentOverride(examIdValue, studentIdValue, data) {
  const examId = idOf(examIdValue), studentId = idOf(studentIdValue); if (!examId || !studentId) throw new Error('INVALID_OVERRIDE');
  if (env.demo.enabled) {
    const exam = (demoStore.exams || []).find((e) => e.id === examId); const student = demoStore.students.find((s) => s.id === studentId && (s.classIds || []).includes(exam?.classId));
    if (!exam || !student) throw new Error('STUDENT_NOT_IN_CLASS');
    demoStore.examStudentOverrides = demoStore.examStudentOverrides || [];
    let row = demoStore.examStudentOverrides.find((x) => x.examId === examId && x.studentId === studentId);
    if (!row) { row = { examId, studentId }; demoStore.examStudentOverrides.push(row); }
    Object.assign(row, data, { isEnabled: true, updatedAt: new Date().toISOString() }); return row;
  }
  const member = await pool.query(`SELECT 1 FROM exams e JOIN class_students cs ON cs.class_id=e.class_id AND cs.student_id=$2 AND cs.status='ACTIVE' WHERE e.id=$1`, [examId, studentId]);
  if (!member.rows[0]) throw new Error('STUDENT_NOT_IN_CLASS');
  const { rows } = await pool.query(`
    INSERT INTO exam_student_overrides(exam_id,student_id,extra_minutes,max_attempts_override,reopen_until,is_enabled,updated_at)
    VALUES($1,$2,$3,$4,NULLIF($5,'')::timestamptz,TRUE,NOW())
    ON CONFLICT(exam_id,student_id) DO UPDATE SET extra_minutes=EXCLUDED.extra_minutes,max_attempts_override=EXCLUDED.max_attempts_override,reopen_until=EXCLUDED.reopen_until,is_enabled=TRUE,updated_at=NOW()
    RETURNING exam_id AS "examId",student_id AS "studentId",extra_minutes AS "extraMinutes",max_attempts_override AS "maxAttemptsOverride",reopen_until AS "reopenUntil",is_enabled AS "isEnabled"
  `, [examId, studentId, data.extraMinutes, data.maxAttemptsOverride, data.reopenUntil || '']);
  return rows[0];
}

async function findStudentExams(userId) {
  if (env.demo.enabled) {
    const sid = demoStudentId(userId); const student = demoStore.students.find((s) => s.id === sid); if (!student) return [];
    return (demoStore.exams || []).filter((e) => ['PUBLISHED', 'CLOSED'].includes(e.status) && student.classIds.includes(e.classId)).map((e) => {
      const attempts = (demoStore.examAttempts || []).filter((a) => a.examId === e.id && a.studentId === sid);
      const override = (demoStore.examStudentOverrides || []).find((o) => o.examId === e.id && o.studentId === sid && o.isEnabled !== false) || null;
      const sorted = [...attempts].sort((a, b) => b.attemptNo - a.attemptNo);
      return { ...e, className: demoStore.classes.find((c) => c.id === e.classId)?.name || '', attempts: attempts.length, lastAttemptNo: sorted[0]?.attemptNo || null, lastStatus: sorted[0]?.status || null, lastScore: sorted[0]?.score ?? null, lastAttemptId: sorted[0]?.id || null, extraMinutes: override?.extraMinutes || 0, effectiveMaxAttempts: override?.maxAttemptsOverride || e.maxAttempts, reopenUntil: override?.reopenUntil || null };
    });
  }
  const { rows } = await pool.query(`
    SELECT e.id,e.title,e.description,e.duration_minutes AS "durationMinutes",e.start_at AS "startAt",e.end_at AS "endAt",e.max_attempts AS "maxAttempts",e.show_result AS "showResult",e.status,c.name AS "className",
           e.pass_score_percent::float AS "passScorePercent",COALESCE(o.extra_minutes,0)::int AS "extraMinutes",COALESCE(o.max_attempts_override,e.max_attempts)::int AS "effectiveMaxAttempts",o.reopen_until AS "reopenUntil",
           COUNT(ea.id)::int AS attempts,MAX(ea.attempt_no)::int AS "lastAttemptNo",
           (ARRAY_AGG(ea.status ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1] AS "lastStatus",
           (ARRAY_AGG(ea.score ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1]::float AS "lastScore",
           (ARRAY_AGG(ea.auto_score ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1]::float AS "lastAutoScore",
           (ARRAY_AGG(ea.id ORDER BY ea.attempt_no DESC) FILTER(WHERE ea.id IS NOT NULL))[1] AS "lastAttemptId"
      FROM student_accounts sa JOIN class_students cs ON cs.student_id=sa.student_id AND cs.status='ACTIVE'
      JOIN exams e ON e.class_id=cs.class_id AND e.status IN ('PUBLISHED','CLOSED') JOIN classes c ON c.id=e.class_id
      LEFT JOIN exam_student_overrides o ON o.exam_id=e.id AND o.student_id=sa.student_id AND o.is_enabled=TRUE
      LEFT JOIN exam_attempts ea ON ea.exam_id=e.id AND ea.student_id=sa.student_id
     WHERE sa.user_id=$1 GROUP BY e.id,c.id,o.exam_id,o.student_id ORDER BY e.start_at NULLS FIRST,e.id DESC
  `, [userId]);
  return rows;
}

async function buildAttemptQuestionOrder(client, examId, attemptId, randomizeQuestions, randomizeOptions) {
  let qRes = await client.query(`SELECT question_id,sort_order,options FROM exam_question_snapshots WHERE exam_id=$1 ORDER BY sort_order,question_id`, [examId]);
  if (!qRes.rows.length) {
    qRes = await client.query(`SELECT eq.question_id,eq.sort_order,COALESCE((SELECT jsonb_agg(jsonb_build_object('optionKey',qo.option_key) ORDER BY qo.sort_order,qo.id) FROM question_options qo WHERE qo.question_id=eq.question_id),'[]'::jsonb) AS options FROM exam_questions eq WHERE eq.exam_id=$1 ORDER BY eq.sort_order,eq.question_id`, [examId]);
  }
  const ordered = randomizeQuestions ? shuffle(qRes.rows) : qRes.rows;
  for (let i = 0; i < ordered.length; i += 1) {
    const keys = (Array.isArray(ordered[i].options) ? ordered[i].options : []).map((o) => String(o.optionKey || '')).filter(Boolean);
    const optionOrder = randomizeOptions ? shuffle(keys) : keys;
    await client.query(`INSERT INTO exam_attempt_questions(attempt_id,question_id,sort_order,option_order) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(attempt_id,question_id) DO NOTHING`, [attemptId, ordered[i].question_id, i + 1, JSON.stringify(optionOrder)]);
  }
}

async function startAttempt(examIdValue, userId) {
  const examId = idOf(examIdValue); if (!examId) throw new Error('EXAM_NOT_FOUND');
  if (env.demo.enabled) {
    const sid = demoStudentId(userId); const exam = (demoStore.exams || []).find((e) => e.id === examId); const student = demoStore.students.find((s) => s.id === sid);
    const override = (demoStore.examStudentOverrides || []).find((o) => o.examId === examId && o.studentId === sid && o.isEnabled !== false);
    const reopen = override?.reopenUntil && Date.now() <= new Date(override.reopenUntil).getTime();
    if (!exam || !student || !student.classIds.includes(exam.classId) || !(exam.status === 'PUBLISHED' || (exam.status === 'CLOSED' && reopen))) throw new Error('EXAM_NOT_AVAILABLE');
    const now = Date.now(); if (exam.startAt && now < new Date(exam.startAt).getTime()) throw new Error('EXAM_NOT_STARTED'); if (exam.endAt && now > new Date(exam.endAt).getTime() && !reopen) throw new Error('EXAM_CLOSED');
    const active = (demoStore.examAttempts || []).find((a) => a.examId === examId && a.studentId === sid && a.status === 'IN_PROGRESS'); if (active) return active;
    const count = (demoStore.examAttempts || []).filter((a) => a.examId === examId && a.studentId === sid).length; const maxAttempts = override?.maxAttemptsOverride || exam.maxAttempts; if (count >= maxAttempts) throw new Error('MAX_ATTEMPTS_REACHED');
    demoStore.examAttempts = demoStore.examAttempts || []; const effectiveDurationMinutes = Number(exam.durationMinutes) + Number(override?.extraMinutes || 0);
    const attempt = { id: Math.max(0, ...demoStore.examAttempts.map((a) => a.id)) + 1, examId, studentId: sid, attemptNo: count + 1, status: 'IN_PROGRESS', startedAt: new Date().toISOString(), effectiveDurationMinutes, lastSavedAt: null, score: null, autoScore: null, maxScore: null };
    demoStore.examAttempts.push(attempt); demoStore.examAttemptQuestions = demoStore.examAttemptQuestions || [];
    let questions = demoSnapshotQuestions(examId); if (!questions.length) questions = demoLiveQuestions(examId); if (exam.randomizeQuestions) questions = shuffle(questions);
    questions.forEach((q, index) => { let keys = (q.options || []).map((o) => o.optionKey); if (exam.randomizeOptions) keys = shuffle(keys); demoStore.examAttemptQuestions.push({ attemptId: attempt.id, questionId: q.id, sortOrder: index + 1, optionOrder: keys }); });
    return attempt;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const student = await client.query(`SELECT student_id FROM student_accounts WHERE user_id=$1`, [userId]); if (!student.rows[0]) throw new Error('STUDENT_NOT_FOUND'); const sid = student.rows[0].student_id;
    const exam = await client.query(`
      SELECT e.*,EXISTS(SELECT 1 FROM class_students cs WHERE cs.class_id=e.class_id AND cs.student_id=$2 AND cs.status='ACTIVE') AS member,
             COALESCE(o.extra_minutes,0) AS extra_minutes,o.max_attempts_override,o.reopen_until
        FROM exams e LEFT JOIN exam_student_overrides o ON o.exam_id=e.id AND o.student_id=$2 AND o.is_enabled=TRUE
       WHERE e.id=$1 FOR UPDATE OF e
    `, [examId, sid]);
    const e = exam.rows[0]; const now = new Date(); const reopen = e?.reopen_until && now <= new Date(e.reopen_until);
    if (!e || !e.member || !(e.status === 'PUBLISHED' || (e.status === 'CLOSED' && reopen))) throw new Error('EXAM_NOT_AVAILABLE');
    if (e.start_at && now < new Date(e.start_at)) throw new Error('EXAM_NOT_STARTED'); if (e.end_at && now > new Date(e.end_at) && !reopen) throw new Error('EXAM_CLOSED');
    const active = await client.query(`SELECT id FROM exam_attempts WHERE exam_id=$1 AND student_id=$2 AND status='IN_PROGRESS' ORDER BY attempt_no DESC LIMIT 1`, [examId, sid]);
    if (active.rows[0]) { await client.query('COMMIT'); return { id: active.rows[0].id }; }
    const count = await client.query(`SELECT COUNT(*)::int AS count FROM exam_attempts WHERE exam_id=$1 AND student_id=$2`, [examId, sid]); const maxAttempts = Number(e.max_attempts_override || e.max_attempts);
    if (count.rows[0].count >= maxAttempts) throw new Error('MAX_ATTEMPTS_REACHED');
    const effectiveDuration = Number(e.duration_minutes) + Number(e.extra_minutes || 0);
    const { rows } = await client.query(`INSERT INTO exam_attempts(exam_id,student_id,attempt_no,status,effective_duration_minutes) VALUES($1,$2,$3,'IN_PROGRESS',$4) RETURNING id,attempt_no AS "attemptNo",started_at AS "startedAt",effective_duration_minutes AS "effectiveDurationMinutes"`, [examId, sid, count.rows[0].count + 1, effectiveDuration]);
    await buildAttemptQuestionOrder(client, examId, rows[0].id, e.randomize_questions, e.randomize_options);
    await client.query('COMMIT'); return rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

function applyAttemptOrdering(exam, attemptQuestionRows) {
  if (!attemptQuestionRows?.length) return exam;
  const byQuestion = new Map(exam.questions.map((q) => [Number(q.id), q]));
  exam.questions = attemptQuestionRows.sort((a, b) => a.sortOrder - b.sortOrder).map((row) => {
    const q = byQuestion.get(Number(row.questionId)); if (!q) return null;
    const order = Array.isArray(row.optionOrder) ? row.optionOrder.map(String) : [];
    const rank = new Map(order.map((k, i) => [k, i]));
    const options = [...(q.options || [])].sort((a, b) => (rank.get(String(a.optionKey)) ?? 999) - (rank.get(String(b.optionKey)) ?? 999));
    return { ...q, options };
  }).filter(Boolean);
  return exam;
}

async function findAttempt(attemptIdValue, userId) {
  const attemptId = idOf(attemptIdValue); if (!attemptId) return null;
  if (env.demo.enabled) {
    const sid = demoStudentId(userId); const a = (demoStore.examAttempts || []).find((x) => x.id === attemptId && x.studentId === sid); if (!a) return null;
    const exam = applyAttemptOrdering(await findById(a.examId), (demoStore.examAttemptQuestions || []).filter((x) => x.attemptId === attemptId));
    const answers = (demoStore.examAnswers || []).filter((x) => x.attemptId === attemptId); const duration = Number(a.effectiveDurationMinutes || exam.durationMinutes); const deadline = new Date(new Date(a.startedAt).getTime() + duration * 60000).toISOString();
    return { ...a, exam, answers, deadline };
  }
  const aRes = await pool.query(`SELECT ea.id,ea.exam_id AS "examId",ea.student_id AS "studentId",ea.attempt_no AS "attemptNo",ea.status,ea.started_at AS "startedAt",ea.submitted_at AS "submittedAt",ea.score::float,ea.auto_score::float AS "autoScore",ea.max_score::float AS "maxScore",COALESCE(ea.effective_duration_minutes,e.duration_minutes) AS "durationMinutes",e.show_result AS "showResult",e.title FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id JOIN student_accounts sa ON sa.student_id=ea.student_id WHERE ea.id=$1 AND sa.user_id=$2`, [attemptId, userId]);
  if (!aRes.rows[0]) return null; const a = aRes.rows[0]; let exam = await findById(a.examId);
  const qOrder = await pool.query(`SELECT question_id AS "questionId",sort_order AS "sortOrder",option_order AS "optionOrder" FROM exam_attempt_questions WHERE attempt_id=$1 ORDER BY sort_order,question_id`, [attemptId]); exam = applyAttemptOrdering(exam, qOrder.rows);
  const ans = await pool.query(`SELECT question_id AS "questionId",selected_option_id AS "selectedOptionId",selected_option_key AS "selectedOptionKey",COALESCE(answer_text,'') AS "answerText",is_correct AS "isCorrect",awarded_score::float AS "awardedScore",grading_status AS "gradingStatus",COALESCE(teacher_feedback,'') AS "teacherFeedback",graded_at AS "gradedAt" FROM exam_answers WHERE attempt_id=$1`, [attemptId]);
  const deadline = new Date(new Date(a.startedAt).getTime() + Number(a.durationMinutes) * 60000).toISOString(); return { ...a, exam, answers: ans.rows, deadline };
}

async function saveAnswer(attemptIdValue, userId, data) {
  const attemptId = idOf(attemptIdValue), questionId = idOf(data.questionId); if (!attemptId || !questionId) throw new Error('INVALID_ANSWER');
  if (env.demo.enabled) {
    const sid = demoStudentId(userId); const a = (demoStore.examAttempts || []).find((x) => x.id === attemptId && x.studentId === sid && x.status === 'IN_PROGRESS'); if (!a) throw new Error('ATTEMPT_NOT_ACTIVE');
    const exam = await findById(a.examId); if (Date.now() > new Date(a.startedAt).getTime() + Number(a.effectiveDurationMinutes || exam.durationMinutes) * 60000) throw new Error('ATTEMPT_EXPIRED');
    const q = exam.questions.find((x) => Number(x.id) === questionId); if (!q) throw new Error('QUESTION_NOT_IN_EXAM'); let optionKey = data.selectedOptionKey ? String(data.selectedOptionKey) : null;
    if (optionKey && !q.options.some((o) => String(o.optionKey) === optionKey)) throw new Error('INVALID_OPTION'); if (q.questionType === 'ESSAY') optionKey = null;
    demoStore.examAnswers = demoStore.examAnswers || []; let ans = demoStore.examAnswers.find((x) => x.attemptId === attemptId && x.questionId === questionId); if (!ans) { ans = { attemptId, questionId, gradingStatus: 'NOT_GRADED' }; demoStore.examAnswers.push(ans); }
    Object.assign(ans, { selectedOptionId: null, selectedOptionKey: optionKey, answerText: String(data.answerText || ''), savedAt: new Date().toISOString() }); a.lastSavedAt = ans.savedAt; return ans;
  }
  const ownership = await pool.query(`SELECT ea.exam_id,COALESCE(ea.effective_duration_minutes,e.duration_minutes) AS duration FROM exam_attempts ea JOIN student_accounts sa ON sa.student_id=ea.student_id JOIN exams e ON e.id=ea.exam_id WHERE ea.id=$1 AND sa.user_id=$2 AND ea.status='IN_PROGRESS' AND NOW() <= ea.started_at + (COALESCE(ea.effective_duration_minutes,e.duration_minutes)::text || ' minute')::interval`, [attemptId, userId]);
  if (!ownership.rows[0]) throw new Error('ATTEMPT_NOT_ACTIVE');
  let qRes = await pool.query(`SELECT question_type AS "questionType",options FROM exam_question_snapshots WHERE exam_id=$1 AND question_id=$2`, [ownership.rows[0].exam_id, questionId]);
  if (!qRes.rows[0]) qRes = await pool.query(`SELECT q.question_type AS "questionType",COALESCE((SELECT jsonb_agg(jsonb_build_object('optionKey',qo.option_key) ORDER BY qo.sort_order,qo.id) FROM question_options qo WHERE qo.question_id=q.id),'[]'::jsonb) AS options FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 AND eq.question_id=$2`, [ownership.rows[0].exam_id, questionId]);
  const q = qRes.rows[0]; if (!q) throw new Error('QUESTION_NOT_IN_EXAM'); let optionKey = data.selectedOptionKey ? String(data.selectedOptionKey).trim() : null;
  if (optionKey && !(Array.isArray(q.options) ? q.options : []).some((o) => String(o.optionKey) === optionKey)) throw new Error('INVALID_OPTION'); if (q.questionType === 'ESSAY') optionKey = null;
  const { rows } = await pool.query(`INSERT INTO exam_answers(attempt_id,question_id,selected_option_id,selected_option_key,answer_text,grading_status,saved_at) VALUES($1,$2,NULL,$3,NULLIF($4,''),'NOT_GRADED',NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=NULL,selected_option_key=EXCLUDED.selected_option_key,answer_text=EXCLUDED.answer_text,grading_status='NOT_GRADED',is_correct=NULL,awarded_score=NULL,teacher_feedback=NULL,graded_by=NULL,graded_at=NULL,saved_at=NOW() RETURNING question_id AS "questionId",selected_option_key AS "selectedOptionKey",answer_text AS "answerText",saved_at AS "savedAt"`, [attemptId, questionId, optionKey, String(data.answerText || '')]);
  await pool.query(`UPDATE exam_attempts SET last_saved_at=NOW() WHERE id=$1`, [attemptId]); return rows[0];
}

async function updateProgress(client, studentId) {
  await client.query(`INSERT INTO student_progress_summary(student_id,average_score,attendance_rate) VALUES($1,0,0) ON CONFLICT(student_id) DO NOTHING`, [studentId]);
  await client.query(`UPDATE student_progress_summary sp SET average_score=COALESCE(src.avg_score,0),updated_at=NOW() FROM (SELECT student_id,ROUND(AVG((score/NULLIF(max_score,0))*10)::numeric,2) AS avg_score FROM student_scores WHERE student_id=$1 GROUP BY student_id) src WHERE sp.student_id=src.student_id`, [studentId]);
}

async function gradeAttempt(attemptIdValue, userId, autoSubmitted = false) {
  const attemptId = idOf(attemptIdValue); if (!attemptId) throw new Error('ATTEMPT_NOT_FOUND');
  if (env.demo.enabled) {
    const sid = demoStudentId(userId); const a = (demoStore.examAttempts || []).find((x) => x.id === attemptId && x.studentId === sid && x.status === 'IN_PROGRESS'); if (!a) throw new Error('ATTEMPT_NOT_ACTIVE'); const exam = await findById(a.examId);
    let autoScore = 0, max = 0, hasEssay = false; demoStore.examAnswers = demoStore.examAnswers || [];
    for (const q of exam.questions) {
      max += Number(q.points); let ans = demoStore.examAnswers.find((x) => x.attemptId === attemptId && x.questionId === q.id); if (!ans) { ans = { attemptId, questionId: q.id, selectedOptionKey: null, answerText: '', gradingStatus: 'NOT_GRADED' }; demoStore.examAnswers.push(ans); }
      if (q.questionType === 'ESSAY') { hasEssay = true; ans.isCorrect = null; ans.awardedScore = null; ans.gradingStatus = 'PENDING_MANUAL'; continue; }
      let correct = false; if (q.questionType === 'FILL_BLANK') correct = String(ans.answerText || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase(); else correct = q.options.some((o) => String(o.optionKey) === String(ans.selectedOptionKey || '') && o.isCorrect);
      ans.isCorrect = correct; ans.awardedScore = correct ? Number(q.points) : 0; ans.gradingStatus = 'AUTO_GRADED'; autoScore += ans.awardedScore;
    }
    a.status = hasEssay ? 'PENDING_GRADING' : (autoSubmitted ? 'AUTO_SUBMITTED' : 'GRADED'); a.submittedAt = new Date().toISOString(); a.autoScore = autoScore; a.score = hasEssay ? null : autoScore; a.maxScore = max; a.passed = !hasEssay && max > 0 ? autoScore / max * 100 >= Number(exam.passScorePercent || 50) : null;
    if (!hasEssay) { demoStore.studentScores = demoStore.studentScores || []; let scoreRow = demoStore.studentScores.find((x) => x.studentId === sid && x.examId === a.examId); if (!scoreRow) { scoreRow = { id: Math.max(0, ...demoStore.studentScores.map((x) => x.id || 0)) + 1, studentId: sid, examId: a.examId, classId: Number(exam.classId), title: exam.title, category: 'EXAM', score: autoScore, maxScore: max, recordedAt: new Date().toISOString().slice(0, 10) }; demoStore.studentScores.push(scoreRow); } else Object.assign(scoreRow, { classId: Number(exam.classId), score: autoScore, maxScore: max, recordedAt: new Date().toISOString().slice(0, 10) }); }
    return a;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const aRes = await client.query(`SELECT ea.*,e.title,e.id AS exam_ref,e.class_id,e.pass_score_percent FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id JOIN student_accounts sa ON sa.student_id=ea.student_id WHERE ea.id=$1 AND sa.user_id=$2 FOR UPDATE`, [attemptId, userId]); const a = aRes.rows[0]; if (!a || a.status !== 'IN_PROGRESS') throw new Error('ATTEMPT_NOT_ACTIVE');
    let questions = await client.query(`SELECT question_id AS id,question_type,correct_answer,points::float,options FROM exam_question_snapshots WHERE exam_id=$1 ORDER BY sort_order`, [a.exam_id]);
    if (!questions.rows.length) questions = await client.query(`SELECT q.id,q.question_type,q.correct_answer,eq.points::float,COALESCE((SELECT jsonb_agg(jsonb_build_object('optionKey',qo.option_key,'isCorrect',qo.is_correct) ORDER BY qo.sort_order,qo.id) FROM question_options qo WHERE qo.question_id=q.id),'[]'::jsonb) AS options FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 ORDER BY eq.sort_order`, [a.exam_id]);
    let autoScore = 0, max = 0, hasEssay = false;
    for (const q of questions.rows) {
      max += Number(q.points); const ansRes = await client.query(`SELECT selected_option_key,COALESCE(answer_text,'') AS answer_text FROM exam_answers WHERE attempt_id=$1 AND question_id=$2`, [attemptId, q.id]); const ans = ansRes.rows[0] || { selected_option_key: null, answer_text: '' };
      if (q.question_type === 'ESSAY') { hasEssay = true; await client.query(`INSERT INTO exam_answers(attempt_id,question_id,selected_option_id,selected_option_key,answer_text,is_correct,awarded_score,grading_status,saved_at) VALUES($1,$2,NULL,NULL,NULLIF($3,''),NULL,NULL,'PENDING_MANUAL',NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET is_correct=NULL,awarded_score=NULL,grading_status='PENDING_MANUAL',teacher_feedback=NULL,graded_by=NULL,graded_at=NULL,saved_at=NOW()`, [attemptId, q.id, ans.answer_text]); continue; }
      let correct = false; if (q.question_type === 'FILL_BLANK') correct = String(ans.answer_text || '').trim().toLocaleLowerCase() === String(q.correct_answer || '').trim().toLocaleLowerCase(); else correct = (Array.isArray(q.options) ? q.options : []).some((o) => String(o.optionKey) === String(ans.selected_option_key || '') && o.isCorrect === true);
      const awarded = correct ? Number(q.points) : 0; autoScore += awarded;
      await client.query(`INSERT INTO exam_answers(attempt_id,question_id,selected_option_id,selected_option_key,answer_text,is_correct,awarded_score,grading_status,saved_at) VALUES($1,$2,NULL,$3,NULLIF($4,''),$5,$6,'AUTO_GRADED',NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_id=NULL,selected_option_key=EXCLUDED.selected_option_key,is_correct=EXCLUDED.is_correct,awarded_score=EXCLUDED.awarded_score,grading_status='AUTO_GRADED',saved_at=NOW()`, [attemptId, q.id, ans.selected_option_key, ans.answer_text, correct, awarded]);
    }
    const status = hasEssay ? 'PENDING_GRADING' : (autoSubmitted ? 'AUTO_SUBMITTED' : 'GRADED'); const finalScore = hasEssay ? null : autoScore;
    await client.query(`UPDATE exam_attempts SET status=$2,submitted_at=NOW(),last_saved_at=NOW(),auto_score=$3,score=$4,max_score=$5 WHERE id=$1`, [attemptId, status, autoScore, finalScore, max]);
    if (!hasEssay) { await client.query(`INSERT INTO student_scores(student_id,exam_id,class_id,title,category,score,max_score,recorded_at) VALUES($1,$2,$3,$4,'EXAM',$5,$6,CURRENT_DATE) ON CONFLICT(student_id,exam_id) WHERE exam_id IS NOT NULL DO UPDATE SET class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,recorded_at=CURRENT_DATE`, [a.student_id, a.exam_id, a.class_id, a.title, autoScore, max]); await updateProgress(client, a.student_id); }
    await client.query('COMMIT'); return { id: attemptId, score: finalScore, autoScore, maxScore: max, status, passed: hasEssay ? null : (max > 0 && autoScore / max * 100 >= Number(a.pass_score_percent || 50)) };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function findAttemptForTeacher(examIdValue, attemptIdValue) {
  const examId = idOf(examIdValue), attemptId = idOf(attemptIdValue); if (!examId || !attemptId) return null;
  if (env.demo.enabled) {
    const a = (demoStore.examAttempts || []).find((x) => x.id === attemptId && x.examId === examId); if (!a) return null; const exam = applyAttemptOrdering(await findById(examId), (demoStore.examAttemptQuestions || []).filter((x) => x.attemptId === attemptId)); const student = demoStore.students.find((s) => s.id === a.studentId); const answers = (demoStore.examAnswers || []).filter((x) => x.attemptId === attemptId); const map = new Map(answers.map((x) => [Number(x.questionId), x])); return { ...a, studentName: student?.fullName || '', exam: { ...exam, questions: exam.questions.map((q) => ({ ...q, answer: map.get(Number(q.id)) || { answerText: '', awardedScore: null, teacherFeedback: '', gradingStatus: 'NOT_GRADED' } })) } };
  }
  const aRes = await pool.query(`SELECT ea.id,ea.exam_id AS "examId",ea.student_id AS "studentId",s.full_name AS "studentName",ea.attempt_no AS "attemptNo",ea.status,ea.started_at AS "startedAt",ea.submitted_at AS "submittedAt",ea.score::float,ea.auto_score::float AS "autoScore",ea.max_score::float AS "maxScore" FROM exam_attempts ea JOIN students s ON s.id=ea.student_id WHERE ea.id=$1 AND ea.exam_id=$2`, [attemptId, examId]); if (!aRes.rows[0]) return null;
  let exam = await findById(examId); const qOrder = await pool.query(`SELECT question_id AS "questionId",sort_order AS "sortOrder",option_order AS "optionOrder" FROM exam_attempt_questions WHERE attempt_id=$1 ORDER BY sort_order`, [attemptId]); exam = applyAttemptOrdering(exam, qOrder.rows);
  const ans = await pool.query(`SELECT question_id AS "questionId",selected_option_id AS "selectedOptionId",selected_option_key AS "selectedOptionKey",COALESCE(answer_text,'') AS "answerText",is_correct AS "isCorrect",awarded_score::float AS "awardedScore",grading_status AS "gradingStatus",COALESCE(teacher_feedback,'') AS "teacherFeedback",graded_at AS "gradedAt" FROM exam_answers WHERE attempt_id=$1`, [attemptId]); const map = new Map(ans.rows.map((x) => [Number(x.questionId), x])); exam.questions = exam.questions.map((q) => ({ ...q, answer: map.get(Number(q.id)) || { answerText: '', awardedScore: null, teacherFeedback: '', gradingStatus: 'NOT_GRADED' } })); return { ...aRes.rows[0], exam };
}

async function manualGradeAttempt(examIdValue, attemptIdValue, userId, grades) {
  const examId = idOf(examIdValue), attemptId = idOf(attemptIdValue); if (!examId || !attemptId) throw new Error('ATTEMPT_NOT_FOUND');
  if (env.demo.enabled) {
    const a = (demoStore.examAttempts || []).find((x) => x.id === attemptId && x.examId === examId); if (!a) throw new Error('ATTEMPT_NOT_FOUND'); if (!['PENDING_GRADING', 'GRADED'].includes(a.status)) throw new Error('ATTEMPT_NOT_GRADABLE'); const exam = await findById(examId); const essay = exam.questions.filter((q) => q.questionType === 'ESSAY'); const gradeMap = new Map(grades.map((g) => [Number(g.questionId), g]));
    for (const q of essay) { const g = gradeMap.get(Number(q.id)); if (!g) throw new Error('MANUAL_GRADE_REQUIRED'); const score = Number(g.awardedScore); if (!Number.isFinite(score) || score < 0 || score > Number(q.points)) throw new Error('INVALID_MANUAL_SCORE'); let ans = (demoStore.examAnswers || []).find((x) => x.attemptId === attemptId && x.questionId === q.id); if (!ans) { ans = { attemptId, questionId: q.id, answerText: '' }; demoStore.examAnswers.push(ans); } Object.assign(ans, { awardedScore: score, isCorrect: null, gradingStatus: 'MANUALLY_GRADED', teacherFeedback: String(g.teacherFeedback || ''), gradedBy: Number(userId), gradedAt: new Date().toISOString() }); }
    const answers = (demoStore.examAnswers || []).filter((x) => x.attemptId === attemptId); a.score = answers.reduce((sum, x) => sum + Number(x.awardedScore || 0), 0); a.status = 'GRADED'; a.maxScore = exam.totalPoints; a.passed = a.maxScore > 0 ? a.score / a.maxScore * 100 >= Number(exam.passScorePercent || 50) : false; demoStore.studentScores = demoStore.studentScores || []; let sr = demoStore.studentScores.find((x) => x.studentId === a.studentId && x.examId === examId); if (!sr) { sr = { id: Math.max(0, ...demoStore.studentScores.map((x) => x.id || 0)) + 1, studentId: a.studentId, examId, classId: Number(exam.classId), title: exam.title, category: 'EXAM', score: a.score, maxScore: a.maxScore, recordedAt: new Date().toISOString().slice(0, 10) }; demoStore.studentScores.push(sr); } else Object.assign(sr, { classId: Number(exam.classId), score: a.score, maxScore: a.maxScore, recordedAt: new Date().toISOString().slice(0, 10) }); return a;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); const aRes = await client.query(`SELECT ea.*,e.title,e.class_id,e.pass_score_percent FROM exam_attempts ea JOIN exams e ON e.id=ea.exam_id WHERE ea.id=$1 AND ea.exam_id=$2 FOR UPDATE`, [attemptId, examId]); const a = aRes.rows[0]; if (!a) throw new Error('ATTEMPT_NOT_FOUND'); if (!['PENDING_GRADING', 'GRADED'].includes(a.status)) throw new Error('ATTEMPT_NOT_GRADABLE');
    let essayRes = await client.query(`SELECT question_id AS id,points::float FROM exam_question_snapshots WHERE exam_id=$1 AND question_type='ESSAY' ORDER BY sort_order`, [examId]); if (!essayRes.rows.length) essayRes = await client.query(`SELECT q.id,eq.points::float AS points FROM exam_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.exam_id=$1 AND q.question_type='ESSAY' ORDER BY eq.sort_order`, [examId]); if (!essayRes.rows.length) throw new Error('NO_MANUAL_QUESTIONS');
    const gradeMap = new Map(grades.map((g) => [Number(g.questionId), g])); for (const q of essayRes.rows) { const g = gradeMap.get(Number(q.id)); if (!g) throw new Error('MANUAL_GRADE_REQUIRED'); const score = Number(g.awardedScore); if (!Number.isFinite(score) || score < 0 || score > Number(q.points)) throw new Error('INVALID_MANUAL_SCORE'); await client.query(`INSERT INTO exam_answers(attempt_id,question_id,answer_text,is_correct,awarded_score,grading_status,teacher_feedback,graded_by,graded_at,saved_at) VALUES($1,$2,'',NULL,$3,'MANUALLY_GRADED',NULLIF($4,''),$5,NOW(),NOW()) ON CONFLICT(attempt_id,question_id) DO UPDATE SET is_correct=NULL,awarded_score=EXCLUDED.awarded_score,grading_status='MANUALLY_GRADED',teacher_feedback=EXCLUDED.teacher_feedback,graded_by=EXCLUDED.graded_by,graded_at=NOW()`, [attemptId, q.id, score, String(g.teacherFeedback || ''), userId]); }
    let totals = await client.query(`SELECT COALESCE(SUM(COALESCE(ans.awarded_score,0)),0)::float AS score,COALESCE(SUM(s.points),0)::float AS max_score FROM exam_question_snapshots s LEFT JOIN exam_answers ans ON ans.attempt_id=$2 AND ans.question_id=s.question_id WHERE s.exam_id=$1`, [examId, attemptId]); if (!Number(totals.rows[0]?.max_score)) totals = await client.query(`SELECT COALESCE(SUM(COALESCE(ans.awarded_score,0)),0)::float AS score,COALESCE(SUM(eq.points),0)::float AS max_score FROM exam_questions eq LEFT JOIN exam_answers ans ON ans.attempt_id=$2 AND ans.question_id=eq.question_id WHERE eq.exam_id=$1`, [examId, attemptId]); const total = totals.rows[0]; await client.query(`UPDATE exam_attempts SET status='GRADED',score=$2,max_score=$3,last_saved_at=NOW() WHERE id=$1`, [attemptId, total.score, total.max_score]); await client.query(`INSERT INTO student_scores(student_id,exam_id,class_id,title,category,score,max_score,recorded_at) VALUES($1,$2,$3,$4,'EXAM',$5,$6,CURRENT_DATE) ON CONFLICT(student_id,exam_id) WHERE exam_id IS NOT NULL DO UPDATE SET class_id=EXCLUDED.class_id,score=EXCLUDED.score,max_score=EXCLUDED.max_score,recorded_at=CURRENT_DATE`, [a.student_id, examId, a.class_id, a.title, total.score, total.max_score]); await updateProgress(client, a.student_id); await client.query('COMMIT'); return { id: attemptId, status: 'GRADED', score: total.score, maxScore: total.max_score, passed: total.max_score > 0 && total.score / total.max_score * 100 >= Number(a.pass_score_percent || 50) };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

module.exports = {
  findClasses, findAll, findById, create, update, publish, close, duplicate, saveStudentOverride,
  findStudentExams, startAttempt, findAttempt, saveAnswer, gradeAttempt, findAttemptForTeacher, manualGradeAttempt,
};
