const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

async function findGrades() {
  if (env.demo.enabled) {
    return [6, 7, 8, 9].map((gradeNo) => ({ id: gradeNo, gradeNo, name: `Khối ${gradeNo}` }));
  }
  const { rows } = await pool.query(`SELECT id, grade_no AS "gradeNo", name FROM grades WHERE grade_no IN (6,7,8,9) ORDER BY grade_no`);
  return rows;
}

async function findAll() {
  if (env.demo.enabled) {
    return demoStore.classes.filter((c) => c.status !== 'DELETED').map((c) => ({
      ...c,
      studentCount: demoStore.students.filter((s) => s.status !== 'DELETED' && (s.classIds || []).includes(c.id)).length,
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
           COUNT(cs.student_id) FILTER (WHERE s.deleted_at IS NULL)::int AS "studentCount"
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
      LEFT JOIN class_students cs ON cs.class_id = c.id AND cs.status = 'ACTIVE'
      LEFT JOIN students s ON s.id = cs.student_id
     WHERE c.deleted_at IS NULL
     GROUP BY c.id, g.id
     ORDER BY g.grade_no, c.name
  `);
  return rows;
}

async function findById(id) {
  if (env.demo.enabled) {
    const c = demoStore.classes.find((item) => item.id === Number(id) && item.status !== 'DELETED');
    if (!c) return null;
    return {
      ...c,
      students: demoStore.students.filter((s) => s.status !== 'DELETED' && (s.classIds || []).includes(c.id)),
    };
  }

  const classResult = await pool.query(`
    SELECT c.id,
           c.name,
           g.grade_no AS grade,
           c.grade_id AS "gradeId",
           c.school_year AS "schoolYear",
           c.schedule_text AS schedule,
           c.status
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
     WHERE c.id = $1 AND c.deleted_at IS NULL
  `, [id]);

  if (!classResult.rows[0]) return null;

  const studentResult = await pool.query(`
    SELECT s.id,
           s.full_name AS "fullName",
           s.school,
           s.school_class AS "schoolClass",
           COALESCE(pu.phone, s.parent_phone) AS "parentPhone",
           pu.full_name AS "parentName",
           s.status,
           COALESCE(sp.average_score, 0)::float AS "averageScore",
           COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate"
      FROM class_students cs
      JOIN students s ON s.id = cs.student_id AND s.deleted_at IS NULL
      LEFT JOIN student_progress_summary sp ON sp.student_id = s.id
      LEFT JOIN parent_students ps ON ps.student_id=s.id
      LEFT JOIN users pu ON pu.id=ps.parent_user_id
     WHERE cs.class_id = $1
       AND cs.status = 'ACTIVE'
     ORDER BY s.full_name
  `, [id]);

  return { ...classResult.rows[0], students: studentResult.rows };
}

async function create(data, actorUserId) {
  if (env.demo.enabled) {
    const item = {
      id: nextId(demoStore.classes), name: data.name, grade: Number(data.grade),
      schoolYear: data.schoolYear, schedule: data.schedule, status: data.status || 'ACTIVE', teacherId: actorUserId,
    };
    demoStore.classes.push(item);
    return item;
  }
  const { rows } = await pool.query(`
    INSERT INTO classes(name,grade_id,teacher_id,school_year,schedule_text,status)
    SELECT $1,g.id,$2,$3,$4,$5 FROM grades g WHERE g.grade_no=$6
    RETURNING id`, [data.name, actorUserId, data.schoolYear, data.schedule || null, data.status || 'ACTIVE', data.grade]);
  if (!rows[0]) throw new Error('Khối lớp không hợp lệ.');
  return findById(rows[0].id);
}

async function update(id, data) {
  if (env.demo.enabled) {
    const item = demoStore.classes.find((c) => c.id === Number(id) && c.status !== 'DELETED');
    if (!item) return null;
    Object.assign(item, { name: data.name, grade: Number(data.grade), schoolYear: data.schoolYear, schedule: data.schedule, status: data.status });
    return item;
  }
  const { rowCount } = await pool.query(`
    UPDATE classes c
       SET name=$1,
           grade_id=(SELECT id FROM grades WHERE grade_no=$2),
           school_year=$3,
           schedule_text=$4,
           status=$5,
           updated_at=NOW()
     WHERE c.id=$6 AND c.deleted_at IS NULL`,
    [data.name, data.grade, data.schoolYear, data.schedule || null, data.status || 'ACTIVE', id]);
  if (!rowCount) return null;
  return findById(id);
}

async function softDelete(id) {
  if (env.demo.enabled) {
    const item = demoStore.classes.find((c) => c.id === Number(id) && c.status !== 'DELETED');
    if (!item) return false;
    item.status = 'DELETED';
    demoStore.students.forEach((s) => { s.classIds = (s.classIds || []).filter((cid) => cid !== item.id); });
    return true;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`UPDATE classes SET status='INACTIVE',deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, [id]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE class_students SET status='INACTIVE',left_at=CURRENT_DATE WHERE class_id=$1`, [id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}

module.exports = { findGrades, findAll, findById, create, update, softDelete };
