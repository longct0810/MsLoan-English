const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function findAll() {
  if (env.demoMode) {
    return demoStore.classes.map((c) => ({
      ...c,
      studentCount: demoStore.students.filter((s) => s.classIds.includes(c.id)).length,
    }));
  }

  const { rows } = await pool.query(`
    SELECT c.id,
           c.name,
           g.name AS "gradeName",
           g.grade_no AS grade,
           c.school_year AS "schoolYear",
           c.schedule_text AS schedule,
           c.status,
           COUNT(cs.student_id)::int AS "studentCount"
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
      LEFT JOIN class_students cs
        ON cs.class_id = c.id
       AND cs.status = 'ACTIVE'
     GROUP BY c.id, g.id
     ORDER BY g.grade_no, c.name
  `);
  return rows;
}

async function findById(id) {
  if (env.demoMode) {
    const c = demoStore.classes.find((item) => item.id === Number(id));
    if (!c) return null;
    return {
      ...c,
      students: demoStore.students.filter((s) => s.classIds.includes(c.id)),
    };
  }

  const classResult = await pool.query(`
    SELECT c.id,
           c.name,
           g.grade_no AS grade,
           c.school_year AS "schoolYear",
           c.schedule_text AS schedule,
           c.status
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
     WHERE c.id = $1
  `, [id]);

  if (!classResult.rows[0]) return null;

  const studentResult = await pool.query(`
    SELECT s.id,
           s.full_name AS "fullName",
           s.school,
           s.school_class AS "schoolClass",
           s.parent_phone AS "parentPhone",
           s.status,
           COALESCE(sp.average_score, 0)::float AS "averageScore",
           COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate"
      FROM class_students cs
      JOIN students s ON s.id = cs.student_id
      LEFT JOIN student_progress_summary sp ON sp.student_id = s.id
     WHERE cs.class_id = $1
       AND cs.status = 'ACTIVE'
     ORDER BY s.full_name
  `, [id]);

  return { ...classResult.rows[0], students: studentResult.rows };
}

module.exports = { findAll, findById };
