const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function classForStudent(student) {
  return demoStore.classes.find((c) => student.classIds.includes(c.id)) || null;
}

function buildStudentSnapshot(studentId) {
  const student = demoStore.students.find((s) => s.id === Number(studentId));
  if (!student) return null;

  const classInfo = classForStudent(student);
  const assignments = demoStore.assignments
    .filter((a) => student.classIds.includes(a.classId))
    .map((a) => {
      const submission = demoStore.assignmentSubmissions.find(
        (s) => s.assignmentId === a.id && s.studentId === student.id,
      );
      return { ...a, submission: submission || { status: 'NOT_STARTED', score: null, submittedAt: null } };
    })
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  const scores = demoStore.studentScores
    .filter((s) => s.studentId === student.id)
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  const skills = demoStore.studentSkills.filter((s) => s.studentId === student.id);
  const notes = demoStore.teacherNotes
    .filter((n) => n.studentId === student.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const attendance = demoStore.attendanceRecords
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const materials = demoStore.materials
    .filter((m) => student.classIds.includes(m.classId))
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
    SELECT a.id, a.title, a.due_at AS "dueAt", COALESCE(a.type, 'HOMEWORK') AS type,
           COALESCE(s.status, 'NOT_STARTED') AS "submissionStatus", s.score, s.submitted_at AS "submittedAt"
      FROM assignments a
      JOIN class_students cs ON cs.class_id = a.class_id AND cs.student_id = $1 AND cs.status = 'ACTIVE'
      LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = $1
     WHERE a.status = 'PUBLISHED'
     ORDER BY a.due_at`, [studentId]);
  assignments.forEach((a) => {
    a.submission = { status: a.submissionStatus, score: a.score, submittedAt: a.submittedAt };
    delete a.submissionStatus;
  });

  const { rows: scores } = await pool.query(`
    SELECT id, title, category, score::float AS score, max_score::float AS "maxScore", recorded_at AS "recordedAt"
      FROM student_scores WHERE student_id = $1 ORDER BY recorded_at DESC`, [studentId]);
  const { rows: skills } = await pool.query(`
    SELECT skill, score::float AS score FROM student_skills WHERE student_id = $1 ORDER BY skill`, [studentId]);
  const { rows: notes } = await pool.query(`
    SELECT id, note, created_at AS "createdAt", author_name AS author
      FROM teacher_notes WHERE student_id = $1 ORDER BY created_at DESC`, [studentId]);
  const { rows: attendance } = await pool.query(`
    SELECT attendance_date AS date, status FROM attendance_records WHERE student_id = $1 ORDER BY attendance_date DESC`, [studentId]);
  const { rows: materials } = await pool.query(`
    SELECT m.id, m.unit_name AS unit, m.title, m.type, m.published_at AS "publishedAt"
      FROM materials m
      JOIN class_students cs ON cs.class_id = m.class_id AND cs.student_id = $1 AND cs.status = 'ACTIVE'
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

module.exports = { getStudentIdByUserId, getStudentSnapshot, getChildrenByParentUserId };
