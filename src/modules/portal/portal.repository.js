const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');
const skillRepo = require('../skills/skill.repository');

function classForStudent(student) {
  return demoStore.classes.find((c) => student.classIds.includes(c.id)) || null;
}

function buildStudentSnapshot(studentId) {
  const student = demoStore.students.find((s) => s.id === Number(studentId));
  if (!student) return null;

  const classInfo = classForStudent(student);
  const assignments = demoStore.assignments
    .filter((a) => student.classIds.includes(a.classId) && a.status === 'PUBLISHED')
    .map((a) => {
      const submission = demoStore.assignmentSubmissions.find(
        (s) => s.assignmentId === a.id && s.studentId === student.id,
      );
      return { ...a, submission: submission || { status: 'NOT_STARTED', score: null, submittedAt: null, submissionText: '', teacherFeedback: '' } };
    })
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  const scores = demoStore.studentScores
    .filter((s) => s.studentId === student.id)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  const skills = demoStore.studentSkills.filter((s) => s.studentId === student.id);
  const notes = demoStore.teacherNotes
    .filter((n) => n.studentId === student.id)
    .map((n) => ({
      ...n,
      sessionTopic: demoStore.classSessions.find((session) => session.id === n.classSessionId)?.topic || null,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const attendanceByDate = new Map();
  demoStore.sessionAttendance
    .filter((a) => a.studentId === student.id)
    .forEach((a) => {
      const session = demoStore.classSessions.find((item) => item.id === a.sessionId);
      if (!session) return;
      attendanceByDate.set(session.sessionDate, {
        date: session.sessionDate,
        status: a.status,
        topic: session.topic,
        note: a.note || '',
      });
    });
  demoStore.attendanceRecords
    .filter((a) => a.studentId === student.id)
    .forEach((a) => {
      if (!attendanceByDate.has(a.date)) attendanceByDate.set(a.date, a);
    });
  const attendance = [...attendanceByDate.values()]
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const materials = demoStore.materials
    .filter((m) => student.classIds.includes(m.classId) && m.status !== 'DRAFT')
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return { student, classInfo, assignments, scores, skills, notes, attendance, materials };
}

async function getStudentIdByUserId(userId) {
  if (env.demo.enabled) {
    return demoStore.studentAccounts.find((x) => x.userId === Number(userId))?.studentId || null;
  }
  const { rows } = await pool.query(
    'SELECT student_id AS "studentId" FROM student_accounts WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return rows[0]?.studentId || null;
}

async function getStudentSnapshot(studentId) {
  if (env.demo.enabled) return buildStudentSnapshot(studentId);

  const { rows: studentRows } = await pool.query(`
    SELECT s.id, s.full_name AS "fullName", s.school, s.school_class AS "schoolClass",
           COALESCE(ps.average_score, 0)::float AS "averageScore",
           COALESCE(ps.attendance_rate, 0)::float AS "attendanceRate"
      FROM students s
      LEFT JOIN student_progress_summary ps ON ps.student_id = s.id
     WHERE s.id = $1
     LIMIT 1`, [studentId]);
  const student = studentRows[0];
  if (!student) return null;

  const { rows: classRows } = await pool.query(`
    SELECT c.id, c.name, g.grade_no AS grade, c.school_year AS "schoolYear", c.schedule_text AS schedule
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN grades g ON g.id = c.grade_id
     WHERE cs.student_id = $1 AND cs.status = 'ACTIVE'
     ORDER BY c.id LIMIT 1`, [studentId]);
  const classInfo = classRows[0] || null;

  const { rows: assignments } = await pool.query(`
    SELECT a.id, a.title, a.description, a.instructions,
           a.due_at AS "dueAt", COALESCE(a.type, 'HOMEWORK') AS type,
           COALESCE(a.max_score, 10)::float AS "maxScore",
           COALESCE(s.status, 'NOT_STARTED') AS "submissionStatus", s.score::float AS score,
           s.submitted_at AS "submittedAt", COALESCE(s.submission_text, '') AS "submissionText",
           COALESCE(s.teacher_feedback, '') AS "teacherFeedback"
      FROM assignments a
      JOIN class_students cs ON cs.class_id = a.class_id AND cs.student_id = $1 AND cs.status = 'ACTIVE'
      LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $1
     WHERE a.status = 'PUBLISHED'
     ORDER BY a.due_at`, [studentId]);
  assignments.forEach((a) => {
    a.submission = { status: a.submissionStatus, score: a.score, submittedAt: a.submittedAt, submissionText: a.submissionText, teacherFeedback: a.teacherFeedback };
    delete a.submissionText;
    delete a.teacherFeedback;
    delete a.submissionStatus;
  });

  const { rows: scores } = await pool.query(`
    SELECT id, title, category, score::float AS score, max_score::float AS "maxScore", recorded_at AS "recordedAt"
      FROM student_scores WHERE student_id = $1 ORDER BY recorded_at DESC`, [studentId]);
  const skills = await skillRepo.getStudentSkillSummary(studentId,{classId:classInfo?.id||null});
  const { rows: notes } = await pool.query(`
    SELECT n.id,
           n.note,
           n.category,
           n.is_parent_visible AS "isParentVisible",
           n.created_at AS "createdAt",
           n.author_name AS author,
           cs.topic AS "sessionTopic"
      FROM teacher_notes n
      LEFT JOIN class_sessions cs ON cs.id = n.class_session_id
     WHERE n.student_id = $1
     ORDER BY n.created_at DESC, n.id DESC`, [studentId]);
  const { rows: attendance } = await pool.query(`
    WITH session_rows AS (
      SELECT cs.session_date AS date,
             a.status,
             cs.topic,
             COALESCE(a.note, '') AS note
        FROM session_attendance a
        JOIN class_sessions cs ON cs.id = a.session_id
       WHERE a.student_id = $1
    ), legacy_rows AS (
      SELECT ar.attendance_date AS date,
             ar.status,
             NULL::varchar AS topic,
             ''::varchar AS note
        FROM attendance_records ar
       WHERE ar.student_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM session_rows sr WHERE sr.date = ar.attendance_date
         )
    )
    SELECT * FROM session_rows
    UNION ALL
    SELECT * FROM legacy_rows
    ORDER BY date DESC`, [studentId]);
  const { rows: materials } = await pool.query(`
    SELECT m.id, m.unit_name AS unit, m.title, m.type, m.description,
           m.resource_url AS "resourceUrl", m.status, m.published_at AS "publishedAt",
           l.title AS "lessonTitle"
      FROM materials m
      JOIN class_students cs ON cs.class_id = m.class_id AND cs.student_id = $1 AND cs.status = 'ACTIVE'
      LEFT JOIN lessons l ON l.id = m.lesson_id
     WHERE COALESCE(m.status, 'PUBLISHED') = 'PUBLISHED'
     ORDER BY m.published_at DESC`, [studentId]);

  return { student, classInfo, assignments, scores, skills, notes, attendance, materials };
}

async function getChildrenByParentUserId(parentUserId) {
  if (env.demo.enabled) {
    return demoStore.parentStudents
      .filter((x) => x.parentUserId === Number(parentUserId))
      .map((x) => ({ ...demoStore.students.find((s) => s.id === x.studentId), relationship: x.relationship }))
      .filter(Boolean);
  }

  const { rows } = await pool.query(`
    SELECT s.id, s.full_name AS "fullName", s.school, s.school_class AS "schoolClass",
           COALESCE(ps.average_score, 0)::float AS "averageScore",
           COALESCE(ps.attendance_rate, 0)::float AS "attendanceRate",
           p.relationship
      FROM parent_students p
      JOIN students s ON s.id = p.student_id
      LEFT JOIN student_progress_summary ps ON ps.student_id = s.id
     WHERE p.parent_user_id = $1 AND s.status = 'ACTIVE'
     ORDER BY s.full_name`, [parentUserId]);
  return rows;
}

function monthRange(value) {
  const match = /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : new Date().toISOString().slice(0, 7);
  const [year, month] = match.split('-').map(Number);
  return { month: match, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

async function getParentReport(studentId, monthValue) {
  const range = monthRange(monthValue);
  if (env.demo.enabled) {
    const snapshot = buildStudentSnapshot(studentId);
    if (!snapshot) return null;
    const inMonth = (value) => String(value || '').slice(0, 7) === range.month;
    const monthScores = snapshot.scores.filter((item) => inMonth(item.recordedAt));
    const graded = monthScores.filter((item) => Number.isFinite(Number(item.score)));
    const monthAssignments = snapshot.assignments.filter((item) => inMonth(item.dueAt) || inMonth(item.submission?.submittedAt));
    const monthAttendance = snapshot.attendance.filter((item) => inMonth(item.date));
    const attended = monthAttendance.filter((item) => ['PRESENT', 'LATE', 'ONLINE'].includes(item.status)).length;
    const previousScores = snapshot.scores.filter((item) => String(item.recordedAt || '').slice(0, 7) < range.month).slice(0, 5);
    const average = graded.length ? graded.reduce((sum, item) => sum + Number(item.score) / Number(item.maxScore || 10) * 10, 0) / graded.length : null;
    const previousAverage = previousScores.length ? previousScores.reduce((sum, item) => sum + Number(item.score) / Number(item.maxScore || 10) * 10, 0) / previousScores.length : null;
    return { month: range.month, student: snapshot.student, classInfo: snapshot.classInfo, scores: graded, assignments: monthAssignments, attendance: monthAttendance, skills: snapshot.skills, notes: snapshot.notes.filter((note) => inMonth(note.createdAt)), trend: snapshot.scores.slice(0, 6).reverse(), metrics: { average: average === null ? null : Number(average.toFixed(2)), change: average !== null && previousAverage !== null ? Number((average - previousAverage).toFixed(2)) : null, attendanceRate: monthAttendance.length ? Math.round(attended * 100 / monthAttendance.length) : null, attended, totalAttendance: monthAttendance.length, submitted: monthAssignments.filter((item) => ['SUBMITTED', 'LATE', 'GRADED'].includes(item.submission.status)).length, totalAssignments: monthAssignments.length, late: monthAssignments.filter((item) => item.submission.status === 'LATE').length } };
  }

  const [studentResult, classResult, scoreResult, attendanceResult, assignmentResult, skillResult, noteResult, trendResult] = await Promise.all([
    pool.query(`SELECT s.id,s.full_name AS "fullName",s.school,s.school_class AS "schoolClass",COALESCE(sp.average_score,0)::float AS "averageScore",COALESCE(sp.attendance_rate,0)::float AS "attendanceRate" FROM students s LEFT JOIN student_progress_summary sp ON sp.student_id=s.id WHERE s.id=$1`, [studentId]),
    pool.query(`SELECT c.id,c.name,g.grade_no AS grade,c.school_year AS "schoolYear",c.schedule_text AS schedule FROM class_students cs JOIN classes c ON c.id=cs.class_id JOIN grades g ON g.id=c.grade_id WHERE cs.student_id=$1 AND cs.status='ACTIVE' ORDER BY c.id LIMIT 1`, [studentId]),
    pool.query(`SELECT id,title,category,score::float AS score,max_score::float AS "maxScore",recorded_at AS "recordedAt" FROM student_scores WHERE student_id=$1 AND recorded_at >= $2::date AND recorded_at < $3::date ORDER BY recorded_at DESC`, [studentId, range.start, range.end]),
    pool.query(`SELECT date,status,topic,note FROM (SELECT cs.session_date AS date,a.status,cs.topic,COALESCE(a.note,'') AS note FROM session_attendance a JOIN class_sessions cs ON cs.id=a.session_id WHERE a.student_id=$1 UNION ALL SELECT attendance_date,status,NULL::varchar,' ' FROM attendance_records WHERE student_id=$1) x WHERE date >= $2::date AND date < $3::date ORDER BY date DESC`, [studentId, range.start, range.end]),
    pool.query(`SELECT a.id,a.title,a.due_at AS "dueAt",COALESCE(a.max_score,10)::float AS "maxScore",COALESCE(s.status,'NOT_STARTED') AS status,s.score::float AS score,s.submitted_at AS "submittedAt" FROM assignments a JOIN class_students cs ON cs.class_id=a.class_id AND cs.student_id=$1 AND cs.status='ACTIVE' LEFT JOIN assignment_submissions s ON s.assignment_id=a.id AND s.student_id=$1 WHERE a.status='PUBLISHED' AND ((a.due_at >= $2::timestamptz AND a.due_at < $3::timestamptz) OR (s.submitted_at >= $2::timestamptz AND s.submitted_at < $3::timestamptz)) ORDER BY a.due_at`, [studentId, range.start, range.end]),
    skillRepo.getStudentSkillSummary(studentId),
    pool.query(`SELECT n.id,n.note,n.category,n.created_at AS "createdAt",n.author_name AS author FROM teacher_notes n WHERE n.student_id=$1 AND n.is_parent_visible=TRUE AND n.created_at >= $2::date AND n.created_at < $3::date ORDER BY n.created_at DESC`, [studentId, range.start, range.end]),
    pool.query(`SELECT id,title,category,score::float AS score,max_score::float AS "maxScore",recorded_at AS "recordedAt" FROM student_scores WHERE student_id=$1 ORDER BY recorded_at DESC LIMIT 6`, [studentId]),
  ]);
  const scores = scoreResult.rows; const attendance = attendanceResult.rows; const assignments = assignmentResult.rows.map((item) => ({ ...item, submission: { status: item.status, score: item.score, submittedAt: item.submittedAt } }));
  const skills = [...skillResult].sort((a,b)=>Number(a.score)-Number(b.score));
  const average = scores.length ? scores.reduce((sum, item) => sum + Number(item.score) / Number(item.maxScore || 10) * 10, 0) / scores.length : null;
  const attended = attendance.filter((item) => ['PRESENT', 'LATE', 'ONLINE'].includes(item.status)).length;
  return { month: range.month, student: studentResult.rows[0], classInfo: classResult.rows[0] || null, scores, attendance, assignments, skills, notes: noteResult.rows, trend: trendResult.rows.reverse(), metrics: { average: average === null ? null : Number(average.toFixed(2)), change: null, attendanceRate: attendance.length ? Math.round(attended * 100 / attendance.length) : null, attended, totalAttendance: attendance.length, submitted: assignments.filter((item) => ['SUBMITTED', 'LATE', 'GRADED'].includes(item.submission.status)).length, totalAssignments: assignments.length, late: assignments.filter((item) => item.submission.status === 'LATE').length } };
}

async function getParentNotificationReads(parentUserId) {
  if (env.demo.enabled) return new Set((demoStore.parentNotificationReads || []).filter((item) => item.parentUserId === Number(parentUserId)).map((item) => item.notificationKey));
  const { rows } = await pool.query('SELECT notification_key AS "notificationKey" FROM parent_notification_reads WHERE parent_user_id=$1', [parentUserId]);
  return new Set(rows.map((row) => row.notificationKey));
}

async function markParentNotificationRead(parentUserId, notificationKey) {
  if (env.demo.enabled) {
    demoStore.parentNotificationReads = demoStore.parentNotificationReads || [];
    if (!demoStore.parentNotificationReads.some((item) => item.parentUserId === Number(parentUserId) && item.notificationKey === notificationKey)) demoStore.parentNotificationReads.push({ parentUserId: Number(parentUserId), notificationKey });
    return true;
  }
  await pool.query('INSERT INTO parent_notification_reads(parent_user_id,notification_key) VALUES($1,$2) ON CONFLICT DO NOTHING', [parentUserId, notificationKey]);
  return true;
}

async function markParentNotificationsRead(parentUserId, notificationKeys) {
  const keys = [...new Set(notificationKeys.map((key) => String(key).trim()).filter((key) => key && key.length <= 500))];
  if (!keys.length) return true;
  if (env.demo.enabled) {
    demoStore.parentNotificationReads = demoStore.parentNotificationReads || [];
    keys.forEach((notificationKey) => {
      if (!demoStore.parentNotificationReads.some((item) => item.parentUserId === Number(parentUserId) && item.notificationKey === notificationKey)) demoStore.parentNotificationReads.push({ parentUserId: Number(parentUserId), notificationKey });
    });
    return true;
  }
  await pool.query('INSERT INTO parent_notification_reads(parent_user_id,notification_key) SELECT $1,UNNEST($2::varchar[]) ON CONFLICT DO NOTHING', [parentUserId, keys]);
  return true;
}

module.exports = { getStudentIdByUserId, getStudentSnapshot, getChildrenByParentUserId, getParentReport, getParentNotificationReads, markParentNotificationRead, markParentNotificationsRead };
