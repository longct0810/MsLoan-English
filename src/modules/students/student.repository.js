const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function findAll({ classId } = {}) {
  if (env.demo.enabled) {
    let students = demoStore.students;
    if (classId) students = students.filter((s) => s.classIds.includes(Number(classId)));
    return students.map((s) => ({
      ...s,
      classes: demoStore.classes.filter((c) => s.classIds.includes(c.id)).map((c) => c.name),
    }));
  }

  const params = [];
  let where = '';
  if (classId) {
    params.push(classId);
    where = 'WHERE cs.class_id = $1';
  }

  const { rows } = await pool.query(`
    SELECT s.id,
           s.full_name AS "fullName",
           s.school,
           s.school_class AS "schoolClass",
           s.parent_phone AS "parentPhone",
           s.status,
           COALESCE(sp.average_score, 0)::float AS "averageScore",
           COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate",
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT c.name), NULL) AS classes
      FROM students s
      LEFT JOIN class_students cs ON cs.student_id = s.id AND cs.status = 'ACTIVE'
      LEFT JOIN classes c ON c.id = cs.class_id
      LEFT JOIN student_progress_summary sp ON sp.student_id = s.id
      ${where}
     GROUP BY s.id, sp.average_score, sp.attendance_rate
     ORDER BY s.full_name
  `, params);
  return rows;
}

module.exports = { findAll };
