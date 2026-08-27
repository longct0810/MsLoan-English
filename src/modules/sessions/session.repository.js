const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

const ATTENDED_STATUSES = new Set(['PRESENT', 'LATE', 'ONLINE']);

function normalizeId(value) {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function demoSessionSummary(session) {
  const classItem = demoStore.classes.find((item) => item.id === session.classId);
  const students = demoStore.students.filter((student) => student.classIds.includes(session.classId));
  const attendance = demoStore.sessionAttendance.filter((item) => item.sessionId === session.id);
  return {
    ...session,
    className: classItem?.name || '',
    grade: classItem?.grade || null,
    studentCount: students.length,
    markedCount: attendance.length,
    presentCount: attendance.filter((item) => item.status === 'PRESENT').length,
    lateCount: attendance.filter((item) => item.status === 'LATE').length,
    absentCount: attendance.filter((item) => ['ABSENT', 'ABSENT_EXCUSED'].includes(item.status)).length,
    onlineCount: attendance.filter((item) => item.status === 'ONLINE').length,
  };
}

async function findAll({ classId } = {}, actorUserId = null, isAdmin = false) {
  if (env.demo.enabled) {
    return demoStore.classSessions
      .filter((session) => !classId || session.classId === Number(classId))
      .filter((session) => {
        const classItem = demoStore.classes.find((item) => item.id === session.classId && item.status !== 'DELETED');
        return Boolean(classItem && (isAdmin || !actorUserId || Number(classItem.teacherId) === Number(actorUserId)));
      })
      .map(demoSessionSummary)
      .sort((a, b) => `${b.sessionDate} ${b.startTime || ''}`.localeCompare(`${a.sessionDate} ${a.startTime || ''}`));
  }

  const selectedClassId = Number(classId) || null;

  const { rows } = await pool.query(`
    SELECT s.id,
           s.class_id AS "classId",
           s.teacher_id AS "teacherId",
           s.session_date AS "sessionDate",
           s.start_time AS "startTime",
           s.end_time AS "endTime",
           s.topic,
           s.lesson_summary AS "lessonSummary",
           s.homework,
           s.status,
           c.name AS "className",
           g.grade_no AS grade,
           (SELECT COUNT(*)::int FROM class_students x WHERE x.class_id = s.class_id AND x.status = 'ACTIVE') AS "studentCount",
           (SELECT COUNT(*)::int FROM session_attendance a WHERE a.session_id = s.id) AS "markedCount",
           (SELECT COUNT(*)::int FROM session_attendance a WHERE a.session_id = s.id AND a.status = 'PRESENT') AS "presentCount",
           (SELECT COUNT(*)::int FROM session_attendance a WHERE a.session_id = s.id AND a.status = 'LATE') AS "lateCount",
           (SELECT COUNT(*)::int FROM session_attendance a WHERE a.session_id = s.id AND a.status IN ('ABSENT', 'ABSENT_EXCUSED')) AS "absentCount",
           (SELECT COUNT(*)::int FROM session_attendance a WHERE a.session_id = s.id AND a.status = 'ONLINE') AS "onlineCount"
      FROM class_sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN grades g ON g.id = c.grade_id
     WHERE ($1::bigint IS NULL OR s.class_id = $1)
       AND c.deleted_at IS NULL
       AND ($3::boolean OR $2::bigint IS NULL OR c.teacher_id = $2)
     ORDER BY s.session_date DESC, s.start_time DESC NULLS LAST, s.id DESC
  `, [selectedClassId, actorUserId, isAdmin]);
  return rows;
}

async function findById(id, actorUserId = null, isAdmin = false) {
  const sessionId = normalizeId(id);
  if (!sessionId) return null;

  if (env.demo.enabled) {
    const session = demoStore.classSessions.find((item) => item.id === sessionId);
    if (!session) return null;
    const classItem = demoStore.classes.find((item) => item.id === session.classId && item.status !== 'DELETED');
    if (!classItem || (!isAdmin && actorUserId && Number(classItem.teacherId) !== Number(actorUserId))) return null;
    const base = demoSessionSummary(session);
    const students = demoStore.students
      .filter((student) => student.classIds.includes(session.classId))
      .map((student) => {
        const attendance = demoStore.sessionAttendance.find(
          (item) => item.sessionId === session.id && item.studentId === student.id,
        );
        return {
          ...student,
          attendanceStatus: attendance?.status || 'PRESENT',
          attendanceNote: attendance?.note || '',
          isMarked: Boolean(attendance),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
    const recentNotes = demoStore.teacherNotes
      .filter((note) => note.classSessionId === session.id)
      .map((note) => ({
        ...note,
        studentName: demoStore.students.find((student) => student.id === note.studentId)?.fullName || '',
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { ...base, students, recentNotes };
  }

  const { rows: sessionRows } = await pool.query(`
    SELECT s.id,
           s.class_id AS "classId",
           s.teacher_id AS "teacherId",
           s.session_date AS "sessionDate",
           s.start_time AS "startTime",
           s.end_time AS "endTime",
           s.topic,
           s.lesson_summary AS "lessonSummary",
           s.homework,
           s.status,
           c.name AS "className",
           c.school_year AS "schoolYear",
           g.grade_no AS grade
      FROM class_sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN grades g ON g.id = c.grade_id
     WHERE s.id = $1
       AND c.deleted_at IS NULL
       AND ($3::boolean OR $2::bigint IS NULL OR c.teacher_id = $2)
     LIMIT 1
  `, [sessionId, actorUserId, isAdmin]);
  if (!sessionRows[0]) return null;

  const [studentResult, noteResult] = await Promise.all([
    pool.query(`
      SELECT st.id,
             st.full_name AS "fullName",
             st.school,
             st.school_class AS "schoolClass",
             COALESCE(ps.average_score, 0)::float AS "averageScore",
             COALESCE(ps.attendance_rate, 0)::float AS "attendanceRate",
             COALESCE(a.status, 'PRESENT') AS "attendanceStatus",
             COALESCE(a.note, '') AS "attendanceNote",
             (a.student_id IS NOT NULL) AS "isMarked"
        FROM class_students cs
        JOIN students st ON st.id = cs.student_id
        LEFT JOIN student_progress_summary ps ON ps.student_id = st.id
        LEFT JOIN session_attendance a
          ON a.session_id = $1
         AND a.student_id = st.id
       WHERE cs.class_id = $2
         AND cs.status = 'ACTIVE'
       ORDER BY st.full_name
    `, [sessionId, sessionRows[0].classId]),
    pool.query(`
      SELECT n.id,
             n.student_id AS "studentId",
             st.full_name AS "studentName",
             n.note,
             n.category,
             n.is_parent_visible AS "isParentVisible",
             n.author_name AS author,
             n.created_at AS "createdAt"
        FROM teacher_notes n
        JOIN students st ON st.id = n.student_id
       WHERE n.class_session_id = $1
       ORDER BY n.created_at DESC, n.id DESC
    `, [sessionId]),
  ]);

  const students = studentResult.rows;
  const counts = students.reduce((acc, student) => {
    if (!student.isMarked) return acc;
    acc.markedCount += 1;
    if (student.attendanceStatus === 'PRESENT') acc.presentCount += 1;
    if (student.attendanceStatus === 'LATE') acc.lateCount += 1;
    if (['ABSENT', 'ABSENT_EXCUSED'].includes(student.attendanceStatus)) acc.absentCount += 1;
    if (student.attendanceStatus === 'ONLINE') acc.onlineCount += 1;
    return acc;
  }, { markedCount: 0, presentCount: 0, lateCount: 0, absentCount: 0, onlineCount: 0 });

  return {
    ...sessionRows[0],
    studentCount: students.length,
    ...counts,
    students,
    recentNotes: noteResult.rows,
  };
}

async function create(data, actorUserId, isAdmin = false) {
  if (env.demo.enabled) {
    const classItem = demoStore.classes.find((item) => item.id === Number(data.classId) && item.status === 'ACTIVE');
    if (!classItem || (!isAdmin && Number(classItem.teacherId) !== Number(actorUserId))) throw new Error('CLASS_NOT_FOUND');
    const nextId = Math.max(0, ...demoStore.classSessions.map((item) => item.id)) + 1;
    const session = {
      id: nextId,
      classId: Number(data.classId),
      teacherId: isAdmin ? Number(classItem.teacherId || actorUserId) : Number(actorUserId),
      sessionDate: data.sessionDate,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      topic: data.topic || '',
      lessonSummary: data.lessonSummary || '',
      homework: data.homework || '',
      status: 'PLANNED',
    };
    demoStore.classSessions.push(session);
    return session;
  }

  const { rows } = await pool.query(`
    INSERT INTO class_sessions
      (class_id, teacher_id, session_date, start_time, end_time, topic, lesson_summary, homework, status)
    SELECT c.id, CASE WHEN $9::boolean THEN COALESCE(c.teacher_id, $2) ELSE $2 END, $3, NULLIF($4, '')::time, NULLIF($5, '')::time, $6, $7, $8, 'PLANNED'
      FROM classes c
     WHERE c.id = $1
       AND c.status = 'ACTIVE'
       AND c.deleted_at IS NULL
       AND ($9::boolean OR c.teacher_id = $2)
    RETURNING id,
              class_id AS "classId",
              teacher_id AS "teacherId",
              session_date AS "sessionDate",
              start_time AS "startTime",
              end_time AS "endTime",
              topic,
              lesson_summary AS "lessonSummary",
              homework,
              status
  `, [data.classId, actorUserId, data.sessionDate, data.startTime || '', data.endTime || '', data.topic || '', data.lessonSummary || '', data.homework || '', isAdmin]);
  if (!rows[0]) throw new Error('CLASS_NOT_FOUND');
  return rows[0];
}

function recalculateDemoAttendance(studentId) {
  const byDate = new Map();
  demoStore.sessionAttendance
    .filter((item) => item.studentId === studentId)
    .forEach((item) => {
      const session = demoStore.classSessions.find((sessionItem) => sessionItem.id === item.sessionId);
      if (session) byDate.set(session.sessionDate, item.status);
    });
  demoStore.attendanceRecords
    .filter((item) => item.studentId === studentId)
    .forEach((item) => {
      if (!byDate.has(item.date)) byDate.set(item.date, item.status);
    });
  const all = [...byDate.values()];
  if (!all.length) return;
  const attended = all.filter((status) => ATTENDED_STATUSES.has(status)).length;
  const student = demoStore.students.find((item) => item.id === studentId);
  if (student) student.attendanceRate = Number(((attended / all.length) * 100).toFixed(1));
}

async function saveAttendance(sessionId, records, actorUserId = null, isAdmin = false) {
  const id = normalizeId(sessionId);
  if (!id) throw new Error('SESSION_NOT_FOUND');

  if (env.demo.enabled) {
    const session = demoStore.classSessions.find((item) => item.id === id);
    const classItem = session ? demoStore.classes.find((item) => item.id === session.classId && item.status !== 'DELETED') : null;
    if (!session || !classItem || (!isAdmin && actorUserId && Number(classItem.teacherId) !== Number(actorUserId))) throw new Error('SESSION_NOT_FOUND');
    records.forEach((record) => {
      const studentId = Number(record.studentId);
      const student = demoStore.students.find(
        (item) => item.id === studentId && item.classIds.includes(session.classId),
      );
      if (!student) return;
      const existing = demoStore.sessionAttendance.find(
        (item) => item.sessionId === id && item.studentId === studentId,
      );
      const value = { sessionId: id, studentId, status: record.status, note: record.note || '' };
      if (existing) Object.assign(existing, value);
      else demoStore.sessionAttendance.push(value);
      recalculateDemoAttendance(studentId);
    });
    if (session.status === 'PLANNED') session.status = 'IN_PROGRESS';
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sessionCheck = await client.query(`
      SELECT s.class_id AS "classId"
        FROM class_sessions s
        JOIN classes c ON c.id=s.class_id
       WHERE s.id=$1
         AND c.deleted_at IS NULL
         AND ($3::boolean OR $2::bigint IS NULL OR c.teacher_id=$2)
       FOR UPDATE OF s
    `, [id, actorUserId, isAdmin]);
    if (!sessionCheck.rows[0]) throw new Error('SESSION_NOT_FOUND');
    const classId = sessionCheck.rows[0].classId;

    for (const record of records) {
      await client.query(`
        INSERT INTO session_attendance (session_id, student_id, status, note, marked_at)
        SELECT $1, cs.student_id, $3, NULLIF($4, ''), NOW()
          FROM class_students cs
         WHERE cs.class_id = $2
           AND cs.student_id = $5
           AND cs.status = 'ACTIVE'
        ON CONFLICT (session_id, student_id)
        DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, marked_at = NOW()
      `, [id, classId, record.status, record.note || '', record.studentId]);
    }

    await client.query(`
      UPDATE class_sessions
         SET status = CASE WHEN status = 'PLANNED' THEN 'IN_PROGRESS' ELSE status END,
             updated_at = NOW()
       WHERE id = $1
    `, [id]);

    await client.query(`
      WITH target_students AS (
        SELECT UNNEST($1::bigint[]) AS student_id
      ), session_rows AS (
        SELECT a.student_id, cs.session_date AS attendance_date, a.status
          FROM session_attendance a
          JOIN class_sessions cs ON cs.id = a.session_id
         WHERE a.student_id = ANY($1::bigint[])
      ), combined AS (
        SELECT student_id, attendance_date, status FROM session_rows
        UNION ALL
        SELECT ar.student_id, ar.attendance_date, ar.status
          FROM attendance_records ar
         WHERE ar.student_id = ANY($1::bigint[])
           AND NOT EXISTS (
             SELECT 1 FROM session_rows sr
              WHERE sr.student_id = ar.student_id
                AND sr.attendance_date = ar.attendance_date
           )
      ), summary AS (
        SELECT student_id,
               ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('PRESENT', 'LATE', 'ONLINE')) / NULLIF(COUNT(*), 0), 1) AS rate
          FROM combined
         GROUP BY student_id
      )
      UPDATE student_progress_summary sp
         SET attendance_rate = summary.rate,
             updated_at = NOW()
        FROM summary
       WHERE sp.student_id = summary.student_id
    `, [records.map((record) => Number(record.studentId))]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function addNote(sessionId, data, authorName, actorUserId = null, isAdmin = false) {
  const id = normalizeId(sessionId);
  if (!id) throw new Error('SESSION_NOT_FOUND');

  if (env.demo.enabled) {
    const session = demoStore.classSessions.find((item) => item.id === id);
    const classItem = session ? demoStore.classes.find((item) => item.id === session.classId && item.status !== 'DELETED') : null;
    if (!session || !classItem || (!isAdmin && actorUserId && Number(classItem.teacherId) !== Number(actorUserId))) throw new Error('SESSION_NOT_FOUND');
    const student = demoStore.students.find(
      (item) => item.id === Number(data.studentId) && item.classIds.includes(session.classId),
    );
    if (!student) throw new Error('STUDENT_NOT_IN_SESSION');
    const nextId = Math.max(0, ...demoStore.teacherNotes.map((item) => item.id)) + 1;
    const note = {
      id: nextId,
      studentId: student.id,
      classSessionId: id,
      note: data.note,
      category: data.category || 'GENERAL',
      isParentVisible: data.isParentVisible !== false,
      createdAt: new Date().toISOString().slice(0, 10),
      author: authorName,
    };
    demoStore.teacherNotes.push(note);
    return note;
  }

  const { rows } = await pool.query(`
    INSERT INTO teacher_notes
      (student_id, class_session_id, note, category, is_parent_visible, author_name, created_at)
    SELECT cs.student_id, $1, $3, $4, $5, $6, CURRENT_DATE
      FROM class_sessions s
      JOIN class_students cs ON cs.class_id = s.class_id
     WHERE s.id = $1
       AND cs.student_id = $2
       AND cs.status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM classes c
          WHERE c.id=s.class_id
            AND c.deleted_at IS NULL
            AND ($8::boolean OR $7::bigint IS NULL OR c.teacher_id=$7)
       )
    RETURNING id,
              student_id AS "studentId",
              class_session_id AS "classSessionId",
              note,
              category,
              is_parent_visible AS "isParentVisible",
              author_name AS author,
              created_at AS "createdAt"
  `, [id, data.studentId, data.note, data.category || 'GENERAL', data.isParentVisible !== false, authorName, actorUserId, isAdmin]);
  if (!rows[0]) throw new Error('STUDENT_NOT_IN_SESSION');
  return rows[0];
}

async function complete(sessionId, actorUserId = null, isAdmin = false) {
  const id = normalizeId(sessionId);
  if (!id) throw new Error('SESSION_NOT_FOUND');
  if (env.demo.enabled) {
    const session = demoStore.classSessions.find((item) => item.id === id);
    const classItem = session ? demoStore.classes.find((item) => item.id === session.classId && item.status !== 'DELETED') : null;
    if (!session || !classItem || (!isAdmin && actorUserId && Number(classItem.teacherId) !== Number(actorUserId))) throw new Error('SESSION_NOT_FOUND');
    session.status = 'COMPLETED';
    return session;
  }
  const { rows } = await pool.query(`
    UPDATE class_sessions s
       SET status = 'COMPLETED', updated_at = NOW()
      FROM classes c
     WHERE s.id = $1
       AND c.id=s.class_id
       AND c.deleted_at IS NULL
       AND ($3::boolean OR $2::bigint IS NULL OR c.teacher_id=$2)
     RETURNING s.id, s.status
  `, [id, actorUserId, isAdmin]);
  if (!rows[0]) throw new Error('SESSION_NOT_FOUND');
  return rows[0];
}

module.exports = { findAll, findById, create, saveAttendance, addNote, complete };
