const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function idOf(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function monthRange(value) {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
  const [year, monthNo] = month.split('-').map(Number);
  const nextYear = monthNo === 12 ? year + 1 : year;
  const nextMonth = monthNo === 12 ? 1 : monthNo + 1;
  return {
    month,
    start: `${year}-${String(monthNo).padStart(2, '0')}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

function inMonth(value, month) {
  if (!value) return false;
  return String(value).slice(0, 7) === month;
}

function normalizeScore(score, maxScore) {
  const scoreNo = Number(score);
  const maxNo = Number(maxScore);
  if (!Number.isFinite(scoreNo) || !Number.isFinite(maxNo) || maxNo <= 0) return null;
  return (scoreNo / maxNo) * 10;
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function isAttended(status) {
  return ['PRESENT', 'LATE', 'ONLINE'].includes(String(status || '').toUpperCase());
}

function buildStats(classes, memberships, scores, attendance, assignmentRows, examAttempts) {
  const statsForClass = (classItem) => {
    const students = memberships.filter((item) => Number(item.classId) === Number(classItem.id));
    const studentIds = new Set(students.map((item) => Number(item.studentId)));
    const classScores = scores.filter((item) => Number(item.classId) === Number(classItem.id));
    const classAttendance = attendance.filter((item) => Number(item.classId) === Number(classItem.id));
    const classAssignments = assignmentRows.filter((item) => Number(item.classId) === Number(classItem.id));
    const classAttempts = examAttempts.filter((item) => Number(item.classId) === Number(classItem.id));

    const scoreAverage = average(classScores.map((item) => normalizeScore(item.score, item.maxScore)).filter((value) => value !== null));
    const attendanceRate = classAttendance.length
      ? classAttendance.filter((item) => isAttended(item.status)).length / classAttendance.length * 100
      : null;
    const expected = classAssignments.length;
    const submitted = classAssignments.filter((item) => ['SUBMITTED', 'LATE', 'GRADED'].includes(item.submissionStatus)).length;
    const submissionRate = expected ? submitted / expected * 100 : null;
    const pendingAssignment = classAssignments.filter((item) => ['SUBMITTED', 'LATE'].includes(item.submissionStatus)).length;
    const pendingExam = classAttempts.filter((item) => item.status === 'PENDING_GRADING').length;

    const attention = students.filter((student) => {
      const studentScores = classScores.filter((item) => Number(item.studentId) === Number(student.studentId));
      const studentAttendance = classAttendance.filter((item) => Number(item.studentId) === Number(student.studentId));
      const studentAssignments = classAssignments.filter((item) => Number(item.studentId) === Number(student.studentId));
      const avg = average(studentScores.map((item) => normalizeScore(item.score, item.maxScore)).filter((value) => value !== null));
      const rate = studentAttendance.length
        ? studentAttendance.filter((item) => isAttended(item.status)).length / studentAttendance.length * 100
        : null;
      const overdue = studentAssignments.filter((item) => item.isOverdue && !['SUBMITTED', 'LATE', 'GRADED'].includes(item.submissionStatus)).length;
      return (avg !== null && avg < 7) || (rate !== null && rate < 90) || overdue > 0;
    }).length;

    return {
      ...classItem,
      studentCount: studentIds.size,
      averageScore: round(scoreAverage),
      attendanceRate: round(attendanceRate),
      submissionRate: round(submissionRate),
      pendingGrading: pendingAssignment + pendingExam,
      attentionCount: attention,
    };
  };

  const classStats = classes.map(statsForClass);
  const distinctStudentIds = new Set(memberships.map((item) => Number(item.studentId)));
  const allScoreAverage = average(scores.map((item) => normalizeScore(item.score, item.maxScore)).filter((value) => value !== null));
  const attendanceRate = attendance.length
    ? attendance.filter((item) => isAttended(item.status)).length / attendance.length * 100
    : null;
  const submissionRate = assignmentRows.length
    ? assignmentRows.filter((item) => ['SUBMITTED', 'LATE', 'GRADED'].includes(item.submissionStatus)).length / assignmentRows.length * 100
    : null;
  const pendingGrading = assignmentRows.filter((item) => ['SUBMITTED', 'LATE'].includes(item.submissionStatus)).length
    + examAttempts.filter((item) => item.status === 'PENDING_GRADING').length;

  const attention = [];
  classes.forEach((classItem) => {
    memberships.filter((item) => Number(item.classId) === Number(classItem.id)).forEach((student) => {
      const studentScores = scores.filter((item) => Number(item.classId) === Number(classItem.id) && Number(item.studentId) === Number(student.studentId));
      const studentAttendance = attendance.filter((item) => Number(item.classId) === Number(classItem.id) && Number(item.studentId) === Number(student.studentId));
      const studentAssignments = assignmentRows.filter((item) => Number(item.classId) === Number(classItem.id) && Number(item.studentId) === Number(student.studentId));
      const avg = average(studentScores.map((item) => normalizeScore(item.score, item.maxScore)).filter((value) => value !== null));
      const rate = studentAttendance.length
        ? studentAttendance.filter((item) => isAttended(item.status)).length / studentAttendance.length * 100
        : null;
      const overdue = studentAssignments.filter((item) => item.isOverdue && !['SUBMITTED', 'LATE', 'GRADED'].includes(item.submissionStatus)).length;
      const reasons = [];
      if (avg !== null && avg < 7) reasons.push(`Điểm TB ${round(avg)}/10`);
      if (rate !== null && rate < 90) reasons.push(`Chuyên cần ${round(rate)}%`);
      if (overdue > 0) reasons.push(`${overdue} bài quá hạn`);
      if (reasons.length) {
        const high = (avg !== null && avg < 6.5) || (rate !== null && rate < 80) || overdue >= 2;
        attention.push({
          studentId: Number(student.studentId),
          fullName: student.fullName,
          classId: Number(classItem.id),
          className: classItem.name,
          averageScore: round(avg),
          attendanceRate: round(rate),
          overdueCount: overdue,
          reasons,
          priority: high ? 'HIGH' : 'MEDIUM',
        });
      }
    });
  });
  attention.sort((a, b) => (a.priority === b.priority ? a.fullName.localeCompare(b.fullName, 'vi') : (a.priority === 'HIGH' ? -1 : 1)));

  return {
    metrics: {
      studentCount: distinctStudentIds.size,
      averageScore: round(allScoreAverage),
      attendanceRate: round(attendanceRate),
      submissionRate: round(submissionRate),
      pendingGrading,
    },
    classStats,
    attention,
  };
}

function demoScoreClassId(score) {
  if (idOf(score.classId)) return Number(score.classId);
  if (idOf(score.assignmentId)) return Number(demoStore.assignments.find((item) => item.id === Number(score.assignmentId))?.classId || 0) || null;
  if (idOf(score.examId)) return Number(demoStore.exams.find((item) => item.id === Number(score.examId))?.classId || 0) || null;
  const student = demoStore.students.find((item) => item.id === Number(score.studentId));
  return student && (student.classIds || []).length === 1 ? Number(student.classIds[0]) : null;
}

async function getReportData(actorUserId, isAdmin, monthValue, classIdValue = null) {
  const range = monthRange(monthValue);
  const requestedClassId = idOf(classIdValue);

  if (env.demo.enabled) {
    const visibleClasses = demoStore.classes
      .filter((item) => item.status === 'ACTIVE' && (isAdmin || Number(item.teacherId) === Number(actorUserId)))
      .map((item) => ({ id: item.id, name: item.name, grade: item.grade, schoolYear: item.schoolYear, schedule: item.schedule }));
    if (requestedClassId && !visibleClasses.some((item) => Number(item.id) === requestedClassId)) throw new Error('CLASS_NOT_FOUND');
    const classes = requestedClassId ? visibleClasses.filter((item) => Number(item.id) === requestedClassId) : visibleClasses;
    const classIds = new Set(classes.map((item) => Number(item.id)));

    const memberships = [];
    demoStore.students.filter((item) => item.status !== 'DELETED').forEach((student) => {
      (student.classIds || []).filter((classId) => classIds.has(Number(classId))).forEach((classId) => memberships.push({
        classId: Number(classId), studentId: Number(student.id), fullName: student.fullName, school: student.school || '', schoolClass: student.schoolClass || '',
      }));
    });

    const scores = demoStore.studentScores
      .map((item) => ({ ...item, classId: demoScoreClassId(item) }))
      .filter((item) => classIds.has(Number(item.classId)) && inMonth(item.recordedAt, range.month));

    const attendance = [];
    demoStore.sessionAttendance.forEach((item) => {
      const session = demoStore.classSessions.find((s) => s.id === Number(item.sessionId));
      if (session && classIds.has(Number(session.classId)) && inMonth(session.sessionDate, range.month)) {
        attendance.push({ classId: Number(session.classId), studentId: Number(item.studentId), date: session.sessionDate, status: item.status, topic: session.topic || '' });
      }
    });
    demoStore.attendanceRecords.forEach((item) => {
      const student = demoStore.students.find((s) => s.id === Number(item.studentId));
      if (!student || !inMonth(item.date, range.month)) return;
      const candidate = (student.classIds || []).filter((classId) => classIds.has(Number(classId)));
      if (candidate.length !== 1) return;
      const duplicate = attendance.some((row) => row.studentId === Number(item.studentId) && String(row.date).slice(0, 10) === String(item.date).slice(0, 10));
      if (!duplicate) attendance.push({ classId: Number(candidate[0]), studentId: Number(item.studentId), date: item.date, status: item.status, topic: '' });
    });

    const now = new Date();
    const assignmentRows = [];
    demoStore.assignments
      .filter((item) => item.status === 'PUBLISHED' && classIds.has(Number(item.classId)) && inMonth(item.dueAt, range.month))
      .forEach((assignment) => {
        memberships.filter((student) => student.classId === Number(assignment.classId)).forEach((student) => {
          const submission = demoStore.assignmentSubmissions.find((item) => item.assignmentId === assignment.id && item.studentId === student.studentId);
          assignmentRows.push({
            classId: Number(assignment.classId), assignmentId: Number(assignment.id), studentId: student.studentId,
            title: assignment.title, dueAt: assignment.dueAt, submissionStatus: submission?.status || 'NOT_STARTED',
            submittedAt: submission?.submittedAt || null, score: submission?.score ?? null,
            maxScore: Number(assignment.maxScore || 10), isOverdue: Boolean(assignment.dueAt && new Date(assignment.dueAt) < now),
          });
        });
      });

    const examAttempts = (demoStore.examAttempts || []).map((attempt) => {
      const exam = demoStore.exams.find((item) => item.id === Number(attempt.examId));
      return { ...attempt, classId: exam?.classId, title: exam?.title || '' };
    }).filter((item) => classIds.has(Number(item.classId)) && (!item.submittedAt || inMonth(item.submittedAt, range.month)));

    const stats = buildStats(classes, memberships, scores, attendance, assignmentRows, examAttempts);
    return { month: range.month, classes: visibleClasses, selectedClassId: requestedClassId, ...stats };
  }

  const { rows: visibleClasses } = await pool.query(`
    SELECT c.id, c.name, g.grade_no AS grade, c.school_year AS "schoolYear", c.schedule_text AS schedule
      FROM classes c
      JOIN grades g ON g.id=c.grade_id
     WHERE c.deleted_at IS NULL AND c.status='ACTIVE'
       AND ($1::boolean OR c.teacher_id=$2)
     ORDER BY g.grade_no, c.name
  `, [isAdmin, actorUserId]);

  if (requestedClassId && !visibleClasses.some((item) => Number(item.id) === requestedClassId)) throw new Error('CLASS_NOT_FOUND');
  const classes = requestedClassId ? visibleClasses.filter((item) => Number(item.id) === requestedClassId) : visibleClasses;
  const classIds = classes.map((item) => Number(item.id));
  if (!classIds.length) return { month: range.month, classes: visibleClasses, selectedClassId: requestedClassId, metrics: { studentCount: 0, averageScore: null, attendanceRate: null, submissionRate: null, pendingGrading: 0 }, classStats: [], attention: [] };

  const [membershipResult, scoreResult, attendanceResult, assignmentResult, examResult] = await Promise.all([
    pool.query(`
      SELECT cs.class_id AS "classId", s.id AS "studentId", s.full_name AS "fullName", COALESCE(s.school,'') AS school, COALESCE(s.school_class,'') AS "schoolClass"
        FROM class_students cs
        JOIN students s ON s.id=cs.student_id
       WHERE cs.class_id = ANY($1::bigint[]) AND cs.status='ACTIVE' AND s.deleted_at IS NULL
       ORDER BY s.full_name
    `, [classIds]),
    pool.query(`
      SELECT ss.id, ss.class_id AS "classId", ss.student_id AS "studentId", ss.title, ss.category,
             ss.score::float AS score, ss.max_score::float AS "maxScore", ss.recorded_at AS "recordedAt"
        FROM student_scores ss
       WHERE ss.class_id = ANY($1::bigint[])
         AND ss.recorded_at >= $2::date AND ss.recorded_at < $3::date
       ORDER BY ss.recorded_at DESC, ss.id DESC
    `, [classIds, range.start, range.end]),
    pool.query(`
      SELECT sess.class_id AS "classId", sa.student_id AS "studentId", sess.session_date AS date, sa.status,
             COALESCE(sess.topic,'') AS topic
        FROM session_attendance sa
        JOIN class_sessions sess ON sess.id=sa.session_id
       WHERE sess.class_id = ANY($1::bigint[])
         AND sess.session_date >= $2::date AND sess.session_date < $3::date
       ORDER BY sess.session_date DESC
    `, [classIds, range.start, range.end]),
    pool.query(`
      SELECT a.class_id AS "classId", a.id AS "assignmentId", cs.student_id AS "studentId", a.title,
             a.due_at AS "dueAt", COALESCE(sub.status,'NOT_STARTED') AS "submissionStatus",
             sub.submitted_at AS "submittedAt", sub.score::float AS score, a.max_score::float AS "maxScore",
             (a.due_at IS NOT NULL AND a.due_at < NOW()) AS "isOverdue"
        FROM assignments a
        JOIN class_students cs ON cs.class_id=a.class_id AND cs.status='ACTIVE'
        JOIN students s ON s.id=cs.student_id AND s.deleted_at IS NULL
        LEFT JOIN assignment_submissions sub ON sub.assignment_id=a.id AND sub.student_id=cs.student_id
       WHERE a.class_id = ANY($1::bigint[]) AND a.status='PUBLISHED'
         AND a.due_at >= $2::date AND a.due_at < $3::date
       ORDER BY a.due_at, a.id
    `, [classIds, range.start, range.end]),
    pool.query(`
      SELECT e.class_id AS "classId", ea.student_id AS "studentId", ea.id AS "attemptId", e.title,
             ea.status, ea.score::float AS score, ea.max_score::float AS "maxScore", ea.submitted_at AS "submittedAt"
        FROM exam_attempts ea
        JOIN exams e ON e.id=ea.exam_id
       WHERE e.class_id = ANY($1::bigint[])
         AND (ea.submitted_at IS NULL OR (ea.submitted_at >= $2::date AND ea.submitted_at < $3::date))
       ORDER BY ea.submitted_at DESC NULLS FIRST
    `, [classIds, range.start, range.end]),
  ]);

  const stats = buildStats(classes, membershipResult.rows, scoreResult.rows, attendanceResult.rows, assignmentResult.rows, examResult.rows);
  return { month: range.month, classes: visibleClasses, selectedClassId: requestedClassId, ...stats };
}

async function getStudentDetail(actorUserId, isAdmin, studentIdValue, classIdValue, monthValue) {
  const studentId = idOf(studentIdValue);
  const classId = idOf(classIdValue);
  const range = monthRange(monthValue);
  if (!studentId || !classId) return null;

  if (env.demo.enabled) {
    const classItem = demoStore.classes.find((item) => item.id === classId && item.status === 'ACTIVE' && (isAdmin || Number(item.teacherId) === Number(actorUserId)));
    const student = demoStore.students.find((item) => item.id === studentId && item.status !== 'DELETED' && (item.classIds || []).includes(classId));
    if (!classItem || !student) return null;
    const scores = demoStore.studentScores.map((item) => ({ ...item, classId: demoScoreClassId(item) }))
      .filter((item) => item.studentId === studentId && item.classId === classId && inMonth(item.recordedAt, range.month));
    const assignments = demoStore.assignments.filter((item) => item.classId === classId && item.status === 'PUBLISHED' && inMonth(item.dueAt, range.month)).map((item) => {
      const submission = demoStore.assignmentSubmissions.find((sub) => sub.assignmentId === item.id && sub.studentId === studentId);
      return { ...item, submission: submission || { status: 'NOT_STARTED', score: null, submittedAt: null, teacherFeedback: '' } };
    });
    const exams = (demoStore.exams || []).filter((item) => item.classId === classId).map((exam) => ({
      ...exam,
      attempts: (demoStore.examAttempts || []).filter((attempt) => attempt.examId === exam.id && attempt.studentId === studentId && (!attempt.submittedAt || inMonth(attempt.submittedAt, range.month))),
    })).filter((exam) => exam.attempts.length);
    const attendance = [];
    demoStore.sessionAttendance.filter((item) => item.studentId === studentId).forEach((item) => {
      const session = demoStore.classSessions.find((s) => s.id === item.sessionId && s.classId === classId);
      if (session && inMonth(session.sessionDate, range.month)) attendance.push({ date: session.sessionDate, status: item.status, topic: session.topic || '', note: item.note || '' });
    });
    demoStore.attendanceRecords.filter((item) => item.studentId === studentId && inMonth(item.date, range.month)).forEach((item) => {
      if (!attendance.some((row) => String(row.date).slice(0, 10) === String(item.date).slice(0, 10))) attendance.push({ date: item.date, status: item.status, topic: '', note: '' });
    });
    const notes = demoStore.teacherNotes.filter((item) => item.studentId === studentId && inMonth(item.createdAt, range.month)).filter((item) => {
      if (!item.classSessionId) return false;
      return demoStore.classSessions.some((session) => session.id === item.classSessionId && session.classId === classId);
    }).map((item) => ({ ...item, sessionTopic: demoStore.classSessions.find((session) => session.id === item.classSessionId)?.topic || '' }));
    const foreignTeacherClass = (student.classIds || []).some((cid) => demoStore.classes.some((c) => c.id === cid && c.status === 'ACTIVE' && Number(c.teacherId) !== Number(classItem.teacherId)));
    const skills = foreignTeacherClass ? [] : demoStore.studentSkills.filter((item) => item.studentId === studentId);
    return { month: range.month, classInfo: classItem, student, scores, assignments, exams, attendance, notes, skills, skillsScoped: !foreignTeacherClass };
  }

  const { rows: baseRows } = await pool.query(`
    SELECT s.id, s.full_name AS "fullName", COALESCE(s.school,'') AS school, COALESCE(s.school_class,'') AS "schoolClass",
           c.id AS "classId", c.name AS "className", g.grade_no AS grade, c.teacher_id AS "teacherId"
      FROM classes c
      JOIN grades g ON g.id=c.grade_id
      JOIN class_students cs ON cs.class_id=c.id AND cs.status='ACTIVE'
      JOIN students s ON s.id=cs.student_id AND s.deleted_at IS NULL
     WHERE c.id=$1 AND s.id=$2 AND c.deleted_at IS NULL AND c.status='ACTIVE'
       AND ($3::boolean OR c.teacher_id=$4)
     LIMIT 1
  `, [classId, studentId, isAdmin, actorUserId]);
  if (!baseRows[0]) return null;
  const base = baseRows[0];

  const [scores, assignments, exams, attendance, notes, teacherCount, skills] = await Promise.all([
    pool.query(`SELECT id,title,category,score::float AS score,max_score::float AS "maxScore",recorded_at AS "recordedAt" FROM student_scores WHERE student_id=$1 AND class_id=$2 AND recorded_at >= $3::date AND recorded_at < $4::date ORDER BY recorded_at DESC,id DESC`, [studentId, classId, range.start, range.end]),
    pool.query(`
      SELECT a.id,a.title,a.type,a.due_at AS "dueAt",a.max_score::float AS "maxScore",
             COALESCE(sub.status,'NOT_STARTED') AS "submissionStatus",sub.score::float AS score,sub.submitted_at AS "submittedAt",COALESCE(sub.teacher_feedback,'') AS "teacherFeedback"
        FROM assignments a
        LEFT JOIN assignment_submissions sub ON sub.assignment_id=a.id AND sub.student_id=$1
       WHERE a.class_id=$2 AND a.status='PUBLISHED' AND a.due_at >= $3::date AND a.due_at < $4::date
       ORDER BY a.due_at,a.id
    `, [studentId, classId, range.start, range.end]),
    pool.query(`
      SELECT e.id,e.title,ea.id AS "attemptId",ea.attempt_no AS "attemptNo",ea.status,ea.score::float AS score,ea.max_score::float AS "maxScore",ea.submitted_at AS "submittedAt"
        FROM exams e JOIN exam_attempts ea ON ea.exam_id=e.id AND ea.student_id=$1
       WHERE e.class_id=$2 AND ea.submitted_at >= $3::date AND ea.submitted_at < $4::date
       ORDER BY ea.submitted_at DESC,ea.id DESC
    `, [studentId, classId, range.start, range.end]),
    pool.query(`
      SELECT sess.session_date AS date,sa.status,COALESCE(sess.topic,'') AS topic,COALESCE(sa.note,'') AS note
        FROM session_attendance sa JOIN class_sessions sess ON sess.id=sa.session_id
       WHERE sa.student_id=$1 AND sess.class_id=$2 AND sess.session_date >= $3::date AND sess.session_date < $4::date
       ORDER BY sess.session_date DESC
    `, [studentId, classId, range.start, range.end]),
    pool.query(`
      SELECT n.id,n.note,n.category,n.is_parent_visible AS "isParentVisible",n.created_at AS "createdAt",n.author_name AS author,COALESCE(sess.topic,'') AS "sessionTopic"
        FROM teacher_notes n JOIN class_sessions sess ON sess.id=n.class_session_id
       WHERE n.student_id=$1 AND sess.class_id=$2 AND n.created_at >= $3::date AND n.created_at < $4::date
       ORDER BY n.created_at DESC,n.id DESC
    `, [studentId, classId, range.start, range.end]),
    pool.query(`
      SELECT COUNT(DISTINCT c.teacher_id)::int AS count
        FROM class_students cs JOIN classes c ON c.id=cs.class_id
       WHERE cs.student_id=$1 AND cs.status='ACTIVE' AND c.deleted_at IS NULL AND c.status='ACTIVE' AND c.teacher_id IS NOT NULL
    `, [studentId]),
    pool.query(`SELECT skill,score::float AS score FROM student_skills WHERE student_id=$1 ORDER BY skill`, [studentId]),
  ]);

  const canShowSkills = Number(teacherCount.rows[0]?.count || 0) <= 1 || isAdmin;
  return {
    month: range.month,
    classInfo: { id: base.classId, name: base.className, grade: base.grade },
    student: { id: base.id, fullName: base.fullName, school: base.school, schoolClass: base.schoolClass },
    scores: scores.rows,
    assignments: assignments.rows.map((item) => ({ ...item, submission: { status: item.submissionStatus, score: item.score, submittedAt: item.submittedAt, teacherFeedback: item.teacherFeedback } })),
    exams: exams.rows,
    attendance: attendance.rows,
    notes: notes.rows,
    skills: canShowSkills ? skills.rows : [],
    skillsScoped: canShowSkills,
  };
}

module.exports = { getReportData, getStudentDetail, monthRange, normalizeScore };
