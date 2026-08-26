const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function getSummary() {
  if (env.demo.enabled) {
    const avgScore = demoStore.students.reduce((sum, s) => sum + s.averageScore, 0) / demoStore.students.length;
    const attention = demoStore.students
      .filter((s) => s.averageScore < 7.2 || s.attendanceRate < 90)
      .slice(0, 5);

    return {
      classCount: demoStore.classes.length,
      studentCount: demoStore.students.length,
      openAssignmentCount: demoStore.assignments.filter((a) => a.status === 'PUBLISHED' && (!a.dueAt || new Date(a.dueAt) >= new Date())).length,
      averageScore: Number(avgScore.toFixed(1)),
      classes: demoStore.classes,
      assignments: demoStore.assignments
        .filter((a) => a.status === 'PUBLISHED')
        .map((a) => {
          const total = demoStore.students.filter((student) => student.classIds.includes(a.classId)).length;
          const submitted = demoStore.assignmentSubmissions.filter((sub) => sub.assignmentId === a.id && ['SUBMITTED','LATE','GRADED'].includes(sub.status)).length;
          return { ...a, total, submitted, className: demoStore.classes.find((c) => c.id === a.classId)?.name || '' };
        })
        .sort((a, b) => new Date(a.dueAt || '2999-12-31') - new Date(b.dueAt || '2999-12-31'))
        .slice(0, 5),
      attention,
      sessions: demoStore.classSessions
        .map((session) => ({ ...session, className: demoStore.classes.find((c) => c.id === session.classId)?.name || '' }))
        .sort((a, b) => `${a.sessionDate} ${a.startTime || ''}`.localeCompare(`${b.sessionDate} ${b.startTime || ''}`))
        .slice(0, 4),
    };
  }

  const [kpis, classes, assignments, attention, sessions] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM classes WHERE status = 'ACTIVE') AS "classCount",
        (SELECT COUNT(*)::int FROM students WHERE status = 'ACTIVE') AS "studentCount",
        (SELECT COUNT(*)::int FROM assignments WHERE status = 'PUBLISHED' AND due_at >= NOW()) AS "openAssignmentCount",
        COALESCE((SELECT ROUND(AVG(average_score)::numeric, 1) FROM student_progress_summary), 0)::float AS "averageScore"
    `),
    pool.query(`
      SELECT c.id, c.name, g.grade_no AS grade, c.schedule_text AS schedule
      FROM classes c JOIN grades g ON g.id = c.grade_id
      WHERE c.status = 'ACTIVE'
      ORDER BY g.grade_no LIMIT 6
    `),
    pool.query(`
      SELECT a.id,
             a.title,
             a.due_at AS "dueAt",
             c.name AS "className",
             COUNT(DISTINCT cs.student_id)::int AS total,
             COUNT(DISTINCT sub.student_id) FILTER (WHERE sub.status IN ('SUBMITTED','LATE','GRADED'))::int AS submitted
        FROM assignments a
        JOIN classes c ON c.id = a.class_id
        LEFT JOIN class_students cs ON cs.class_id = a.class_id AND cs.status = 'ACTIVE'
        LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = cs.student_id
       WHERE a.status = 'PUBLISHED' AND (a.due_at IS NULL OR a.due_at >= NOW())
       GROUP BY a.id, c.id
       ORDER BY a.due_at NULLS LAST
       LIMIT 5
    `),
    pool.query(`
      SELECT s.id, s.full_name AS "fullName",
             COALESCE(sp.average_score, 0)::float AS "averageScore",
             COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate"
      FROM students s
      LEFT JOIN student_progress_summary sp ON sp.student_id = s.id
      WHERE COALESCE(sp.average_score, 0) < 7.2 OR COALESCE(sp.attendance_rate, 100) < 90
      ORDER BY sp.average_score NULLS FIRST LIMIT 5
    `),
    pool.query(`
      SELECT s.id,
             s.session_date AS "sessionDate",
             s.start_time AS "startTime",
             s.topic,
             s.status,
             c.name AS "className"
        FROM class_sessions s
        JOIN classes c ON c.id = s.class_id
       WHERE s.session_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY s.session_date, s.start_time NULLS LAST
       LIMIT 4
    `),
  ]);

  return {
    ...kpis.rows[0],
    classes: classes.rows,
    assignments: assignments.rows,
    attention: attention.rows,
    sessions: sessions.rows,
  };
}

module.exports = { getSummary };
