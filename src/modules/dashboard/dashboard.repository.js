const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

async function getSummary(actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    const classes = demoStore.classes.filter((item) => item.status !== 'DELETED'
      && item.status !== 'INACTIVE'
      && (isAdmin || !actorUserId || Number(item.teacherId) === Number(actorUserId)));
    const classIds = new Set(classes.map((item) => Number(item.id)));
    const students = demoStore.students.filter((item) => item.status !== 'DELETED'
      && (item.classIds || []).some((classId) => classIds.has(Number(classId))));
    const assignments = demoStore.assignments.filter((item) => classIds.has(Number(item.classId)));
    const now = new Date();
    const openAssignments = assignments.filter((item) => item.status === 'PUBLISHED'
      && (!item.dueAt || new Date(item.dueAt) >= now));
    const avgScore = students.length
      ? students.reduce((sum, item) => sum + Number(item.averageScore || 0), 0) / students.length
      : 0;

    return {
      classCount: classes.length,
      studentCount: students.length,
      openAssignmentCount: openAssignments.length,
      averageScore: Number(avgScore.toFixed(1)),
      classes: classes.slice(0, 6),
      assignments: openAssignments
        .map((assignment) => ({
          ...assignment,
          className: classes.find((item) => item.id === assignment.classId)?.name || '',
        }))
        .sort((a, b) => new Date(a.dueAt || '2999-12-31') - new Date(b.dueAt || '2999-12-31'))
        .slice(0, 5),
      attention: students
        .filter((item) => Number(item.averageScore || 0) < 7.2 || Number(item.attendanceRate || 0) < 90)
        .slice(0, 5),
      sessions: demoStore.classSessions
        .filter((item) => classIds.has(Number(item.classId)))
        .map((item) => ({
          ...item,
          className: classes.find((classItem) => classItem.id === item.classId)?.name || '',
        }))
        .sort((a, b) => `${a.sessionDate} ${a.startTime || ''}`.localeCompare(`${b.sessionDate} ${b.startTime || ''}`))
        .slice(0, 4),
    };
  }

  const params = [isAdmin, actorUserId];
  const visibleClasses = `
    SELECT c.id, c.name, c.grade_id, c.schedule_text
      FROM classes c
     WHERE c.deleted_at IS NULL
       AND c.status='ACTIVE'
       AND ($1::boolean OR $2::bigint IS NULL OR c.teacher_id=$2)
  `;

  const [kpis, classes, assignments, attention, sessions] = await Promise.all([
    pool.query(`
      WITH visible_classes AS (${visibleClasses}),
      visible_students AS (
        SELECT DISTINCT cs.student_id
          FROM class_students cs
          JOIN visible_classes vc ON vc.id=cs.class_id
          JOIN students s ON s.id=cs.student_id
         WHERE cs.status='ACTIVE' AND s.deleted_at IS NULL
      )
      SELECT
        (SELECT COUNT(*)::int FROM visible_classes) AS "classCount",
        (SELECT COUNT(*)::int FROM visible_students) AS "studentCount",
        (SELECT COUNT(*)::int
           FROM assignments a
          WHERE a.class_id IN (SELECT id FROM visible_classes)
            AND a.status='PUBLISHED'
            AND (a.due_at IS NULL OR a.due_at >= NOW())) AS "openAssignmentCount",
        COALESCE((
          SELECT ROUND(AVG(sp.average_score)::numeric, 1)
            FROM student_progress_summary sp
            JOIN visible_students vs ON vs.student_id=sp.student_id
        ), 0)::float AS "averageScore"
    `, params),
    pool.query(`
      WITH visible_classes AS (${visibleClasses})
      SELECT vc.id, vc.name, g.grade_no AS grade, vc.schedule_text AS schedule
        FROM visible_classes vc
        JOIN grades g ON g.id=vc.grade_id
       ORDER BY g.grade_no, vc.name
       LIMIT 6
    `, params),
    pool.query(`
      WITH visible_classes AS (${visibleClasses})
      SELECT a.id,
             a.title,
             a.due_at AS "dueAt",
             c.name AS "className",
             COUNT(DISTINCT st.id)::int AS total,
             COUNT(DISTINCT sub.student_id) FILTER (WHERE sub.status IN ('SUBMITTED','LATE','GRADED'))::int AS submitted
        FROM assignments a
        JOIN visible_classes c ON c.id=a.class_id
        LEFT JOIN class_students cs ON cs.class_id=a.class_id AND cs.status='ACTIVE'
        LEFT JOIN students st ON st.id=cs.student_id AND st.deleted_at IS NULL
        LEFT JOIN assignment_submissions sub ON sub.assignment_id=a.id AND sub.student_id=cs.student_id
       WHERE a.status='PUBLISHED' AND (a.due_at IS NULL OR a.due_at >= NOW())
       GROUP BY a.id, c.id, c.name
       ORDER BY a.due_at NULLS LAST, a.id
       LIMIT 5
    `, params),
    pool.query(`
      WITH visible_classes AS (${visibleClasses}),
      visible_students AS (
        SELECT DISTINCT s.id, s.full_name
          FROM students s
          JOIN class_students cs ON cs.student_id=s.id AND cs.status='ACTIVE'
          JOIN visible_classes vc ON vc.id=cs.class_id
         WHERE s.deleted_at IS NULL
      )
      SELECT s.id, s.full_name AS "fullName",
             COALESCE(sp.average_score, 0)::float AS "averageScore",
             COALESCE(sp.attendance_rate, 0)::float AS "attendanceRate"
        FROM visible_students s
        LEFT JOIN student_progress_summary sp ON sp.student_id=s.id
       WHERE COALESCE(sp.average_score, 0) < 7.2 OR COALESCE(sp.attendance_rate, 100) < 90
       ORDER BY sp.average_score NULLS FIRST, s.full_name
       LIMIT 5
    `, params),
    pool.query(`
      WITH visible_classes AS (${visibleClasses})
      SELECT s.id,
             s.session_date AS "sessionDate",
             s.start_time AS "startTime",
             s.topic,
             s.status,
             c.name AS "className"
        FROM class_sessions s
        JOIN visible_classes c ON c.id=s.class_id
       WHERE s.session_date >= CURRENT_DATE - INTERVAL '1 day'
       ORDER BY s.session_date, s.start_time NULLS LAST
       LIMIT 4
    `, params),
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
