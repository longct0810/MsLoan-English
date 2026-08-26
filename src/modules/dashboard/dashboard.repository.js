const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function getSummary() {
  if (env.demoMode) {
    const avgScore = demoStore.students.reduce((sum, s) => sum + s.averageScore, 0) / demoStore.students.length;
    const attention = demoStore.students
      .filter((s) => s.averageScore < 7.2 || s.attendanceRate < 90)
      .slice(0, 5);

    return {
      classCount: demoStore.classes.length,
      studentCount: demoStore.students.length,
      openAssignmentCount: demoStore.assignments.length,
      averageScore: Number(avgScore.toFixed(1)),
      classes: demoStore.classes,
      assignments: demoStore.assignments.map((a) => ({
        ...a,
        className: demoStore.classes.find((c) => c.id === a.classId)?.name || '',
      })),
      attention,
    };
  }

  const [kpis, classes, assignments, attention] = await Promise.all([
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
      SELECT a.id, a.title, a.due_at AS "dueAt", c.name AS "className", 0 AS submitted, 0 AS total
      FROM assignments a JOIN classes c ON c.id = a.class_id
      WHERE a.status = 'PUBLISHED' AND a.due_at >= NOW()
      ORDER BY a.due_at LIMIT 5
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
  ]);

  return {
    ...kpis.rows[0],
    classes: classes.rows,
    assignments: assignments.rows,
    attention: attention.rows,
  };
}

module.exports = { getSummary };
