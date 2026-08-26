const env = require('../../config/env');
const pool = require('../../config/db');
const demoStore = require('../../shared/demo-store');

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function findClasses() {
  if (env.demo.enabled) return demoStore.classes.map((item) => ({ id: item.id, name: item.name, grade: item.grade }));
  const { rows } = await pool.query(`
    SELECT c.id, c.name, g.grade_no AS grade
      FROM classes c
      JOIN grades g ON g.id = c.grade_id
     WHERE c.status = 'ACTIVE'
     ORDER BY g.grade_no, c.name
  `);
  return rows;
}

async function findLessons(classIdValue = null) {
  const classId = normalizeId(classIdValue);
  if (env.demo.enabled) {
    return demoStore.lessons
      .filter((lesson) => !classId || lesson.classId === classId)
      .map((lesson) => ({ id: lesson.id, classId: lesson.classId, title: lesson.title, unitName: lesson.unitName, status: lesson.status }));
  }
  const params = [];
  let where = '';
  if (classId) {
    params.push(classId);
    where = `WHERE class_id = $1`;
  }
  const { rows } = await pool.query(`
    SELECT id, class_id AS "classId", title, unit_name AS "unitName", status
      FROM lessons
      ${where}
     ORDER BY class_id, sort_order, id
  `, params);
  return rows;
}

async function findAll(filters = {}) {
  const classId = normalizeId(filters.classId);
  const status = String(filters.status || '').trim();

  if (env.demo.enabled) {
    return demoStore.assignments
      .filter((item) => (!classId || item.classId === classId) && (!status || item.status === status))
      .map((item) => {
        const classItem = demoStore.classes.find((c) => c.id === item.classId);
        const lesson = demoStore.lessons.find((l) => l.id === item.lessonId);
        const submissions = demoStore.assignmentSubmissions.filter((s) => s.assignmentId === item.id);
        const total = demoStore.students.filter((student) => student.classIds.includes(item.classId)).length;
        const submitted = submissions.filter((s) => ['SUBMITTED', 'LATE', 'GRADED'].includes(s.status)).length;
        const graded = submissions.filter((s) => s.status === 'GRADED').length;
        return { ...item, className: classItem?.name || '', lessonTitle: lesson?.title || null, total, submitted, graded };
      })
      .sort((a, b) => new Date(a.dueAt || '2999-12-31') - new Date(b.dueAt || '2999-12-31'));
  }

  const params = [];
  const where = [];
  if (classId) {
    params.push(classId);
    where.push(`a.class_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT a.id,
           a.class_id AS "classId",
           a.lesson_id AS "lessonId",
           a.title,
           a.description,
           a.instructions,
           a.type,
           a.status,
           a.due_at AS "dueAt",
           a.max_score::float AS "maxScore",
           a.created_at AS "createdAt",
           c.name AS "className",
           l.title AS "lessonTitle",
           COUNT(DISTINCT cs.student_id)::int AS total,
           COUNT(DISTINCT s.student_id) FILTER (WHERE s.status IN ('SUBMITTED','LATE','GRADED'))::int AS submitted,
           COUNT(DISTINCT s.student_id) FILTER (WHERE s.status = 'GRADED')::int AS graded
      FROM assignments a
      JOIN classes c ON c.id = a.class_id
      LEFT JOIN lessons l ON l.id = a.lesson_id
      LEFT JOIN class_students cs ON cs.class_id = a.class_id AND cs.status = 'ACTIVE'
      LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = cs.student_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY a.id, c.id, l.id
     ORDER BY a.due_at NULLS LAST, a.id DESC
  `, params);
  return rows;
}

async function findById(value) {
  const id = normalizeId(value);
  if (!id) return null;

  if (env.demo.enabled) {
    const assignment = demoStore.assignments.find((item) => item.id === id);
    if (!assignment) return null;
    const classItem = demoStore.classes.find((item) => item.id === assignment.classId);
    const lesson = demoStore.lessons.find((item) => item.id === assignment.lessonId);
    const students = demoStore.students
      .filter((student) => student.classIds.includes(assignment.classId))
      .map((student) => ({
        ...student,
        submission: demoStore.assignmentSubmissions.find((s) => s.assignmentId === id && s.studentId === student.id)
          || { status: 'NOT_STARTED', score: null, submittedAt: null, submissionText: '', teacherFeedback: '' },
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
    return { ...assignment, className: classItem?.name || '', grade: classItem?.grade || null, lessonTitle: lesson?.title || null, students };
  }

  const assignmentResult = await pool.query(`
    SELECT a.id,
           a.class_id AS "classId",
           a.lesson_id AS "lessonId",
           a.title,
           a.description,
           a.instructions,
           a.type,
           a.status,
           a.due_at AS "dueAt",
           a.max_score::float AS "maxScore",
           a.published_at AS "publishedAt",
           a.created_at AS "createdAt",
           c.name AS "className",
           g.grade_no AS grade,
           l.title AS "lessonTitle"
      FROM assignments a
      JOIN classes c ON c.id = a.class_id
      JOIN grades g ON g.id = c.grade_id
      LEFT JOIN lessons l ON l.id = a.lesson_id
     WHERE a.id = $1
     LIMIT 1
  `, [id]);
  if (!assignmentResult.rows[0]) return null;

  const { rows: students } = await pool.query(`
    SELECT st.id,
           st.full_name AS "fullName",
           st.school,
           st.school_class AS "schoolClass",
           COALESCE(sub.status, 'NOT_STARTED') AS "submissionStatus",
           sub.score::float AS score,
           sub.submitted_at AS "submittedAt",
           COALESCE(sub.submission_text, '') AS "submissionText",
           COALESCE(sub.teacher_feedback, '') AS "teacherFeedback"
      FROM assignments a
      JOIN class_students cs ON cs.class_id = a.class_id AND cs.status = 'ACTIVE'
      JOIN students st ON st.id = cs.student_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = st.id
     WHERE a.id = $1
     ORDER BY st.full_name
  `, [id]);
  students.forEach((student) => {
    student.submission = {
      status: student.submissionStatus,
      score: student.score,
      submittedAt: student.submittedAt,
      submissionText: student.submissionText,
      teacherFeedback: student.teacherFeedback,
    };
    delete student.submissionStatus;
    delete student.score;
    delete student.submittedAt;
    delete student.submissionText;
    delete student.teacherFeedback;
  });

  return { ...assignmentResult.rows[0], students };
}

async function create(data, userId) {
  if (env.demo.enabled) {
    const classItem = demoStore.classes.find((item) => item.id === Number(data.classId));
    if (!classItem) throw new Error('CLASS_NOT_FOUND');
    if (data.lessonId) {
      const lesson = demoStore.lessons.find((item) => item.id === Number(data.lessonId) && item.classId === Number(data.classId));
      if (!lesson) throw new Error('LESSON_CLASS_MISMATCH');
    }
    const id = Math.max(0, ...demoStore.assignments.map((item) => item.id)) + 1;
    const assignment = {
      id,
      classId: Number(data.classId),
      lessonId: data.lessonId ? Number(data.lessonId) : null,
      title: data.title,
      description: data.description || '',
      instructions: data.instructions || '',
      type: data.type || 'HOMEWORK',
      dueAt: data.dueAt || null,
      status: 'DRAFT',
      maxScore: Number(data.maxScore || 10),
      createdBy: Number(userId),
    };
    demoStore.assignments.push(assignment);
    return assignment;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classCheck = await client.query(`SELECT id FROM classes WHERE id=$1 AND status='ACTIVE'`, [data.classId]);
    if (!classCheck.rows[0]) throw new Error('CLASS_NOT_FOUND');
    if (data.lessonId) {
      const lessonCheck = await client.query(`SELECT id FROM lessons WHERE id=$1 AND class_id=$2`, [data.lessonId, data.classId]);
      if (!lessonCheck.rows[0]) throw new Error('LESSON_CLASS_MISMATCH');
    }
    const { rows } = await client.query(`
      INSERT INTO assignments
        (class_id, lesson_id, title, description, instructions, due_at, status, created_by, type, max_score)
      VALUES ($1, $2, $3, NULLIF($4,''), NULLIF($5,''), NULLIF($6,'')::timestamptz, 'DRAFT', $7, $8, $9)
      RETURNING id, class_id AS "classId", lesson_id AS "lessonId", title, status, due_at AS "dueAt", max_score::float AS "maxScore"
    `, [data.classId, data.lessonId || null, data.title, data.description || '', data.instructions || '', data.dueAt || '', userId, data.type || 'HOMEWORK', data.maxScore || 10]);
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


async function update(value, data) {
  const id = normalizeId(value);
  if (!id) throw new Error('ASSIGNMENT_NOT_FOUND');

  if (env.demo.enabled) {
    const assignment = demoStore.assignments.find((item) => item.id === id);
    const classItem = demoStore.classes.find((item) => item.id === Number(data.classId));
    if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
    if (!classItem) throw new Error('CLASS_NOT_FOUND');
    if (data.lessonId) {
      const lesson = demoStore.lessons.find((item) => item.id === Number(data.lessonId) && item.classId === Number(data.classId));
      if (!lesson) throw new Error('LESSON_CLASS_MISMATCH');
    }
    Object.assign(assignment, {
      classId: Number(data.classId),
      lessonId: data.lessonId ? Number(data.lessonId) : null,
      title: data.title,
      description: data.description || '',
      instructions: data.instructions || '',
      type: data.type || 'HOMEWORK',
      dueAt: data.dueAt || null,
      maxScore: Number(data.maxScore || 10),
    });
    return assignment;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classCheck = await client.query(`SELECT id FROM classes WHERE id=$1 AND status='ACTIVE'`, [data.classId]);
    if (!classCheck.rows[0]) throw new Error('CLASS_NOT_FOUND');
    if (data.lessonId) {
      const lessonCheck = await client.query(`SELECT id FROM lessons WHERE id=$1 AND class_id=$2`, [data.lessonId, data.classId]);
      if (!lessonCheck.rows[0]) throw new Error('LESSON_CLASS_MISMATCH');
    }
    const { rows } = await client.query(`
      UPDATE assignments
         SET class_id=$2, lesson_id=$3, title=$4, description=NULLIF($5,''), instructions=NULLIF($6,''),
             due_at=NULLIF($7,'')::timestamptz, type=$8, max_score=$9
       WHERE id=$1
      RETURNING id, class_id AS "classId", lesson_id AS "lessonId", title, status,
                due_at AS "dueAt", max_score::float AS "maxScore"
    `, [id, data.classId, data.lessonId || null, data.title, data.description || '', data.instructions || '', data.dueAt || '', data.type || 'HOMEWORK', data.maxScore || 10]);
    if (!rows[0]) throw new Error('ASSIGNMENT_NOT_FOUND');
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function publish(value) {
  const id = normalizeId(value);
  if (!id) throw new Error('ASSIGNMENT_NOT_FOUND');
  if (env.demo.enabled) {
    const assignment = demoStore.assignments.find((item) => item.id === id);
    if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
    assignment.status = 'PUBLISHED';
    assignment.publishedAt = new Date().toISOString();
    return assignment;
  }
  const { rows } = await pool.query(`
    UPDATE assignments SET status='PUBLISHED', published_at=COALESCE(published_at,NOW())
     WHERE id=$1
    RETURNING id, status, published_at AS "publishedAt"
  `, [id]);
  if (!rows[0]) throw new Error('ASSIGNMENT_NOT_FOUND');
  return rows[0];
}

async function grade(assignmentIdValue, studentIdValue, data) {
  const assignmentId = normalizeId(assignmentIdValue);
  const studentId = normalizeId(studentIdValue);
  if (!assignmentId || !studentId) throw new Error('SUBMISSION_NOT_FOUND');

  if (env.demo.enabled) {
    const assignment = demoStore.assignments.find((item) => item.id === assignmentId);
    const student = demoStore.students.find((item) => item.id === studentId && item.classIds.includes(assignment?.classId));
    if (!assignment || !student) throw new Error('SUBMISSION_NOT_FOUND');
    let submission = demoStore.assignmentSubmissions.find((item) => item.assignmentId === assignmentId && item.studentId === studentId);
    if (!submission) {
      submission = { assignmentId, studentId, status: 'NOT_STARTED', score: null, submittedAt: null, submissionText: '', teacherFeedback: '' };
      demoStore.assignmentSubmissions.push(submission);
    }
    submission.status = 'GRADED';
    submission.score = Number(data.score);
    submission.teacherFeedback = data.teacherFeedback || '';
    let existingScore = demoStore.studentScores.find((item) => item.assignmentId === assignmentId && item.studentId === studentId);
    if (!existingScore) {
      existingScore = demoStore.studentScores.find((item) => item.studentId === studentId && !item.assignmentId && item.title === assignment.title);
      if (existingScore) existingScore.assignmentId = assignmentId;
    }
    if (existingScore) {
      existingScore.score = Number(data.score);
      existingScore.maxScore = Number(assignment.maxScore || 10);
      existingScore.recordedAt = new Date().toISOString().slice(0, 10);
    } else {
      const id = Math.max(0, ...demoStore.studentScores.map((item) => item.id)) + 1;
      demoStore.studentScores.push({ id, studentId, assignmentId, title: assignment.title, category: assignment.type, score: Number(data.score), maxScore: Number(assignment.maxScore || 10), recordedAt: new Date().toISOString().slice(0, 10) });
    }
    const scoreRows = demoStore.studentScores.filter((item) => item.studentId === studentId);
    if (scoreRows.length) student.averageScore = Number((scoreRows.reduce((sum, item) => sum + (Number(item.score) / Number(item.maxScore || 10)) * 10, 0) / scoreRows.length).toFixed(2));
    return submission;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignmentResult = await client.query(`
      SELECT a.id, a.title, a.type, a.max_score::float AS "maxScore", a.class_id AS "classId"
        FROM assignments a
       WHERE a.id=$1
       FOR UPDATE
    `, [assignmentId]);
    const assignment = assignmentResult.rows[0];
    if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
    const studentCheck = await client.query(`SELECT 1 FROM class_students WHERE class_id=$1 AND student_id=$2 AND status='ACTIVE'`, [assignment.classId, studentId]);
    if (!studentCheck.rows[0]) throw new Error('SUBMISSION_NOT_FOUND');

    const score = Number(data.score);
    if (!Number.isFinite(score) || score < 0 || score > Number(assignment.maxScore)) throw new Error('INVALID_SCORE');

    const { rows } = await client.query(`
      INSERT INTO assignment_submissions
        (assignment_id, student_id, status, score, teacher_feedback, updated_at)
      VALUES ($1,$2,'GRADED',$3,NULLIF($4,''),NOW())
      ON CONFLICT (assignment_id,student_id)
      DO UPDATE SET status='GRADED', score=EXCLUDED.score, teacher_feedback=EXCLUDED.teacher_feedback, updated_at=NOW()
      RETURNING assignment_id AS "assignmentId", student_id AS "studentId", status, score::float AS score, teacher_feedback AS "teacherFeedback"
    `, [assignmentId, studentId, score, data.teacherFeedback || '']);

    await client.query(`
      UPDATE student_scores
         SET assignment_id=$2
       WHERE id = (
         SELECT id FROM student_scores
          WHERE student_id=$1 AND assignment_id IS NULL AND title=$3
          ORDER BY recorded_at DESC, id DESC LIMIT 1
       )
         AND NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=$1 AND assignment_id=$2)
    `, [studentId, assignmentId, assignment.title]);

    await client.query(`
      INSERT INTO student_scores (student_id, assignment_id, title, category, score, max_score, recorded_at)
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE)
      ON CONFLICT (student_id, assignment_id) WHERE assignment_id IS NOT NULL
      DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category, score=EXCLUDED.score,
                    max_score=EXCLUDED.max_score, recorded_at=CURRENT_DATE
    `, [studentId, assignmentId, assignment.title, assignment.type, score, assignment.maxScore]);

    await client.query(`
      INSERT INTO student_progress_summary (student_id, average_score, attendance_rate)
      VALUES ($1, 0, 0)
      ON CONFLICT (student_id) DO NOTHING
    `, [studentId]);
    await client.query(`
      UPDATE student_progress_summary sp
         SET average_score = q.avg_score,
             updated_at = NOW()
        FROM (
          SELECT student_id,
                 ROUND(AVG((score / NULLIF(max_score,0)) * 10)::numeric, 2) AS avg_score
            FROM student_scores
           WHERE student_id=$1
           GROUP BY student_id
        ) q
       WHERE sp.student_id=q.student_id
    `, [studentId]);

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findStudentAssignment(assignmentIdValue, userIdValue) {
  const assignmentId = normalizeId(assignmentIdValue);
  const userId = normalizeId(userIdValue);
  if (!assignmentId || !userId) return null;

  if (env.demo.enabled) {
    const account = demoStore.studentAccounts.find((item) => item.userId === userId);
    if (!account) return null;
    const student = demoStore.students.find((item) => item.id === account.studentId);
    const assignment = demoStore.assignments.find((item) => item.id === assignmentId && item.status === 'PUBLISHED' && student?.classIds.includes(item.classId));
    if (!assignment) return null;
    const classItem = demoStore.classes.find((item) => item.id === assignment.classId);
    const lesson = demoStore.lessons.find((item) => item.id === assignment.lessonId);
    const submission = demoStore.assignmentSubmissions.find((item) => item.assignmentId === assignmentId && item.studentId === student.id)
      || { status: 'NOT_STARTED', score: null, submittedAt: null, submissionText: '', teacherFeedback: '' };
    return { ...assignment, className: classItem?.name || '', lessonTitle: lesson?.title || null, student, submission };
  }

  const { rows } = await pool.query(`
    SELECT a.id,
           a.class_id AS "classId",
           a.lesson_id AS "lessonId",
           a.title,
           a.description,
           a.instructions,
           a.type,
           a.status,
           a.due_at AS "dueAt",
           a.max_score::float AS "maxScore",
           c.name AS "className",
           l.title AS "lessonTitle",
           st.id AS "studentId",
           st.full_name AS "studentName",
           COALESCE(sub.status,'NOT_STARTED') AS "submissionStatus",
           sub.score::float AS score,
           sub.submitted_at AS "submittedAt",
           COALESCE(sub.submission_text,'') AS "submissionText",
           COALESCE(sub.teacher_feedback,'') AS "teacherFeedback"
      FROM student_accounts sa
      JOIN students st ON st.id=sa.student_id
      JOIN class_students cs ON cs.student_id=st.id AND cs.status='ACTIVE'
      JOIN assignments a ON a.class_id=cs.class_id AND a.id=$1 AND a.status='PUBLISHED'
      JOIN classes c ON c.id=a.class_id
      LEFT JOIN lessons l ON l.id=a.lesson_id
      LEFT JOIN assignment_submissions sub ON sub.assignment_id=a.id AND sub.student_id=st.id
     WHERE sa.user_id=$2
     LIMIT 1
  `, [assignmentId, userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    classId: row.classId,
    lessonId: row.lessonId,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    type: row.type,
    status: row.status,
    dueAt: row.dueAt,
    maxScore: row.maxScore,
    className: row.className,
    lessonTitle: row.lessonTitle,
    student: { id: row.studentId, fullName: row.studentName },
    submission: { status: row.submissionStatus, score: row.score, submittedAt: row.submittedAt, submissionText: row.submissionText, teacherFeedback: row.teacherFeedback },
  };
}

async function submitStudentAssignment(assignmentIdValue, userIdValue, submissionText) {
  const assignment = await findStudentAssignment(assignmentIdValue, userIdValue);
  if (!assignment) throw new Error('ASSIGNMENT_NOT_FOUND');
  if (assignment.submission.status === 'GRADED') throw new Error('GRADED_LOCKED');
  const text = String(submissionText || '').trim();
  if (!text) throw new Error('SUBMISSION_REQUIRED');

  const late = assignment.dueAt && new Date() > new Date(assignment.dueAt);
  const status = late ? 'LATE' : 'SUBMITTED';

  if (env.demo.enabled) {
    let submission = demoStore.assignmentSubmissions.find((item) => item.assignmentId === assignment.id && item.studentId === assignment.student.id);
    if (!submission) {
      submission = { assignmentId: assignment.id, studentId: assignment.student.id };
      demoStore.assignmentSubmissions.push(submission);
    }
    Object.assign(submission, { status, score: null, submittedAt: new Date().toISOString(), submissionText: text, teacherFeedback: '' });
    return submission;
  }

  const { rows } = await pool.query(`
    INSERT INTO assignment_submissions
      (assignment_id,student_id,status,score,submitted_at,submission_text,teacher_feedback,updated_at)
    VALUES ($1,$2,$3,NULL,NOW(),$4,NULL,NOW())
    ON CONFLICT (assignment_id,student_id)
    DO UPDATE SET status=EXCLUDED.status, score=NULL, submitted_at=NOW(), submission_text=EXCLUDED.submission_text,
                  teacher_feedback=NULL, updated_at=NOW()
    RETURNING assignment_id AS "assignmentId", student_id AS "studentId", status,
              submitted_at AS "submittedAt", submission_text AS "submissionText"
  `, [assignment.id, assignment.student.id, status, text]);
  return rows[0];
}

module.exports = {
  findClasses,
  findLessons,
  findAll,
  findById,
  create,
  update,
  publish,
  grade,
  findStudentAssignment,
  submitStudentAssignment,
};
