const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');
const env = require('../src/config/env');

async function main() {
  const schema = await fs.readFile(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);

  const passwordHash = await bcrypt.hash(env.demo.teacher.password, env.security.bcryptRounds);
  const user = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($2, $3, $1, 'TEACHER')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id
  `, [passwordHash, env.demo.teacher.fullName, env.demo.teacher.email]);
  const teacherId = user.rows[0].id;

  const studentPasswordHash = await bcrypt.hash(env.demo.student.password, env.security.bcryptRounds);
  const studentUser = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($2, $3, $1, 'STUDENT')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'STUDENT'
    RETURNING id
  `, [studentPasswordHash, env.demo.student.fullName, env.demo.student.email]);
  const studentUserId = studentUser.rows[0].id;

  const parentPasswordHash = await bcrypt.hash(env.demo.parent.password, env.security.bcryptRounds);
  const parentUser = await pool.query(`
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($2, $3, $1, 'PARENT')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'PARENT'
    RETURNING id
  `, [parentPasswordHash, env.demo.parent.fullName, env.demo.parent.email]);
  const parentUserId = parentUser.rows[0].id;

  for (const grade of [6, 7, 8, 9]) {
    await pool.query(`INSERT INTO grades (grade_no, name) VALUES ($1, $2) ON CONFLICT (grade_no) DO NOTHING`, [grade, `Khối ${grade}`]);
  }

  const classDefs = [
    [6, 'English 6 - T2/T5', 'Thứ 2, Thứ 5 • 17:30'],
    [7, 'English 7 - T3/T6', 'Thứ 3, Thứ 6 • 17:30'],
    [8, 'English 8 - T2/T5', 'Thứ 2, Thứ 5 • 19:00'],
    [9, 'English 9 - T3/T6', 'Thứ 3, Thứ 6 • 19:00'],
  ];

  const classIds = {};
  for (const [grade, name, schedule] of classDefs) {
    const result = await pool.query(`
      SELECT id FROM classes WHERE name = $1 AND school_year = $2 LIMIT 1
    `, [name, env.academic.defaultSchoolYear]);
    let id = result.rows[0]?.id;
    if (!id) {
      const inserted = await pool.query(`
        INSERT INTO classes (name, grade_id, teacher_id, school_year, schedule_text)
        SELECT $1, id, $2, $5, $3 FROM grades WHERE grade_no = $4
        RETURNING id
      `, [name, teacherId, schedule, grade, env.academic.defaultSchoolYear]);
      id = inserted.rows[0].id;
    }
    classIds[grade] = id;
  }

  const students = [
    ['Nguyễn Minh Anh', 'THCS Nguyễn Trãi', '6A2', '0900000001', 6, 8.6, 96],
    ['Trần Gia Hân', 'THCS Lê Lợi', '6A1', '0900000002', 6, 7.8, 92],
    [env.demo.student.fullName, 'THCS Văn Quán', '7A3', '0900000003', 7, 7.1, 88],
    ['Phạm Khánh Linh', 'THCS Mỗ Lao', '7A1', '0900000004', 7, 9.0, 100],
    ['Vũ Đức Minh', 'THCS Nguyễn Du', '8A4', '0900000005', 8, 6.9, 84],
    ['Đỗ Ngọc Mai', 'THCS Nguyễn Trãi', '8A2', '0900000006', 8, 8.2, 95],
    ['Bùi Quang Huy', 'THCS Lê Quý Đôn', '9A1', '0900000007', 9, 7.5, 90],
    ['Hoàng Thu Trang', 'THCS Văn Khê', '9A2', '0900000008', 9, 8.8, 98],
  ];

  const studentIds = {};

  for (const [fullName, school, schoolClass, parentPhone, grade, score, attendance] of students) {
    let r = await pool.query(`SELECT id FROM students WHERE full_name = $1 AND parent_phone = $2 LIMIT 1`, [fullName, parentPhone]);
    let studentId = r.rows[0]?.id;
    if (!studentId) {
      r = await pool.query(`INSERT INTO students (full_name, school, school_class, parent_phone) VALUES ($1,$2,$3,$4) RETURNING id`, [fullName, school, schoolClass, parentPhone]);
      studentId = r.rows[0].id;
    }
    studentIds[fullName] = studentId;
    await pool.query(`INSERT INTO class_students (class_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [classIds[grade], studentId]);
    await pool.query(`INSERT INTO student_progress_summary (student_id, average_score, attendance_rate) VALUES ($1,$2,$3) ON CONFLICT (student_id) DO UPDATE SET average_score=EXCLUDED.average_score, attendance_rate=EXCLUDED.attendance_rate, updated_at=NOW()`, [studentId, score, attendance]);
  }

  await pool.query(`INSERT INTO student_accounts (user_id, student_id) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET student_id=EXCLUDED.student_id`, [studentUserId, studentIds[env.demo.student.fullName]]);
  await pool.query(`INSERT INTO parent_students (parent_user_id, student_id, relationship) VALUES ($1,$2,'Bố/Mẹ') ON CONFLICT DO NOTHING`, [parentUserId, studentIds[env.demo.student.fullName]]);
  await pool.query(`INSERT INTO parent_students (parent_user_id, student_id, relationship) VALUES ($1,$2,'Bố/Mẹ') ON CONFLICT DO NOTHING`, [parentUserId, studentIds['Vũ Đức Minh']]);

  const assignmentCount = await pool.query('SELECT COUNT(*)::int AS count FROM assignments');
  if (assignmentCount.rows[0].count === 0) {
    await pool.query(`
      INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
      VALUES
        ($1, 'Unit 1 - Vocabulary', NOW() + INTERVAL '2 day', 'PUBLISHED', $5, 'HOMEWORK'),
        ($2, 'Unit 2 - Grammar', NOW() + INTERVAL '3 day', 'PUBLISHED', $5, 'HOMEWORK'),
        ($3, 'Reading Practice', NOW() + INTERVAL '4 day', 'PUBLISHED', $5, 'HOMEWORK'),
        ($4, 'Exam Review', NOW() + INTERVAL '5 day', 'DRAFT', $5, 'QUIZ')
    `, [classIds[6], classIds[7], classIds[8], classIds[9], teacherId]);
  }



  const portalAssignmentSeeds = [
    [classIds[7], 'Listening - Healthy Living', 'PRACTICE', 4],
    [classIds[7], 'Quiz Unit 2', 'QUIZ', 6],
    [classIds[8], 'Vocabulary Review', 'HOMEWORK', 5],
  ];
  for (const [classId, title, type, days] of portalAssignmentSeeds) {
    await pool.query(`
      INSERT INTO assignments (class_id,title,due_at,status,created_by,type)
      SELECT $1,$2,NOW() + ($4::text || ' day')::interval,'PUBLISHED',$3,$5
       WHERE NOT EXISTS (SELECT 1 FROM assignments WHERE class_id=$1 AND title=$2)
    `, [classId, title, teacherId, days, type]);
  }

  const namId = studentIds[env.demo.student.fullName];
  const minhId = studentIds['Vũ Đức Minh'];
  const linhId = studentIds['Phạm Khánh Linh'];
  const maiId = studentIds['Đỗ Ngọc Mai'];

  async function ensureClassSession({ classId, date, startTime, endTime, topic, lessonSummary, homework, status }) {
    const existing = await pool.query(`
      SELECT id FROM class_sessions
       WHERE class_id = $1 AND session_date = $2 AND topic = $3
       ORDER BY id LIMIT 1
    `, [classId, date, topic]);
    if (existing.rows[0]) {
      await pool.query(`
        UPDATE class_sessions
           SET teacher_id=$2, start_time=$3::time, end_time=$4::time,
               lesson_summary=$5, homework=$6, status=$7, updated_at=NOW()
         WHERE id=$1
      `, [existing.rows[0].id, teacherId, startTime, endTime, lessonSummary, homework, status]);
      return existing.rows[0].id;
    }
    const created = await pool.query(`
      INSERT INTO class_sessions
        (class_id, teacher_id, session_date, start_time, end_time, topic, lesson_summary, homework, status)
      VALUES ($1,$2,$3,$4::time,$5::time,$6,$7,$8,$9)
      RETURNING id
    `, [classId, teacherId, date, startTime, endTime, topic, lessonSummary, homework, status]);
    return created.rows[0].id;
  }

  const class7SessionId = await ensureClassSession({
    classId: classIds[7], date: '2026-08-25', startTime: '17:30', endTime: '19:00',
    topic: 'Unit 2 – Past Simple & Speaking',
    lessonSummary: 'Ôn Past Simple, luyện hỏi đáp về hoạt động cuối tuần và speaking theo cặp.',
    homework: 'Workbook Unit 2 trang 24–25; luyện nghe 10 phút.', status: 'COMPLETED',
  });
  const class8SessionId = await ensureClassSession({
    classId: classIds[8], date: '2026-08-26', startTime: '19:00', endTime: '20:30',
    topic: 'Unit 1 – Teen Life & Listening',
    lessonSummary: 'Reading ngắn, từ vựng Teen Life, nghe ý chính và thảo luận nhóm.',
    homework: 'Vocabulary Review và Listening Practice.', status: 'IN_PROGRESS',
  });
  await ensureClassSession({
    classId: classIds[9], date: '2026-08-27', startTime: '19:00', endTime: '20:30',
    topic: 'Exam Review – Grammar',
    lessonSummary: 'Ôn cấu trúc trọng tâm trước bài kiểm tra.',
    homework: 'Hoàn thành Exam Review.', status: 'PLANNED',
  });

  for (const [sessionId, studentId, status, note] of [
    [class7SessionId, namId, 'PRESENT', ''],
    [class7SessionId, linhId, 'PRESENT', ''],
    [class8SessionId, minhId, 'LATE', 'Đến muộn 10 phút'],
    [class8SessionId, maiId, 'PRESENT', ''],
  ]) {
    await pool.query(`
      INSERT INTO session_attendance (session_id, student_id, status, note)
      VALUES ($1,$2,$3,NULLIF($4,''))
      ON CONFLICT (session_id, student_id)
      DO UPDATE SET status=EXCLUDED.status, note=EXCLUDED.note, marked_at=NOW()
    `, [sessionId, studentId, status, note]);
  }
  const class7Assignments = await pool.query(`SELECT id, title FROM assignments WHERE class_id=$1 ORDER BY id`, [classIds[7]]);
  const grammarAssignment = class7Assignments.rows.find((a) => a.title === 'Unit 2 - Grammar');
  if (grammarAssignment) {
    await pool.query(`INSERT INTO assignment_submissions (assignment_id, student_id, status, score, submitted_at) VALUES ($1,$2,'SUBMITTED',8,NOW()) ON CONFLICT (assignment_id,student_id) DO UPDATE SET status='SUBMITTED', score=8, submitted_at=NOW()`, [grammarAssignment.id, namId]);
  }

  const class8Assignments = await pool.query(`SELECT id, title FROM assignments WHERE class_id=$1 ORDER BY id`, [classIds[8]]);
  const readingAssignment = class8Assignments.rows.find((a) => a.title === 'Reading Practice');
  if (readingAssignment) {
    await pool.query(`INSERT INTO assignment_submissions (assignment_id, student_id, status) VALUES ($1,$2,'LATE') ON CONFLICT (assignment_id,student_id) DO UPDATE SET status='LATE'`, [readingAssignment.id, minhId]);
  }

  const scoreSeeds = [
    [namId, 'Quiz Unit 1', 'Grammar', 7.5, '2026-08-05'],
    [namId, 'Vocabulary Unit 1', 'Vocabulary', 8.2, '2026-08-10'],
    [namId, 'Reading Practice', 'Reading', 7.0, '2026-08-16'],
    [namId, 'Speaking Check', 'Speaking', 6.4, '2026-08-21'],
    [namId, 'Unit 2 - Grammar', 'Grammar', 8.0, '2026-08-26'],
    [minhId, 'Quiz Unit 1', 'Grammar', 6.5, '2026-08-06'],
    [minhId, 'Reading Practice', 'Reading', 7.2, '2026-08-15'],
    [minhId, 'Listening Check', 'Listening', 6.0, '2026-08-23'],
  ];
  for (const row of scoreSeeds) {
    await pool.query(`INSERT INTO student_scores (student_id,title,category,score,max_score,recorded_at) SELECT $1,$2,$3,$4,10,$5 WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=$1 AND title=$2 AND recorded_at=$5)`, row);
  }

  const skillSeeds = {
    [namId]: { Vocabulary:7.8, Grammar:7.2, Listening:6.4, Speaking:6.0, Reading:7.6, Writing:6.8 },
    [minhId]: { Vocabulary:7.0, Grammar:6.3, Listening:5.8, Speaking:6.2, Reading:7.1, Writing:6.0 },
  };
  for (const [studentId, skills] of Object.entries(skillSeeds)) {
    for (const [skill, score] of Object.entries(skills)) {
      await pool.query(`INSERT INTO student_skills (student_id,skill,score) VALUES ($1,$2,$3) ON CONFLICT (student_id,skill) DO UPDATE SET score=EXCLUDED.score`, [studentId, skill, score]);
    }
  }

  await pool.query(`
    INSERT INTO teacher_notes (student_id,class_session_id,note,category,is_parent_visible,author_name,created_at)
    SELECT $1,$2,$3,'PROGRESS',TRUE,$4,'2026-08-25'
     WHERE NOT EXISTS (SELECT 1 FROM teacher_notes WHERE student_id=$1 AND created_at='2026-08-25')
  `, [namId, class7SessionId, 'Nam có tiến bộ ở Grammar. Cần luyện nghe 10–15 phút mỗi ngày và chủ động hơn trong phần Speaking.', env.demo.teacher.fullName]);
  await pool.query(`
    UPDATE teacher_notes SET class_session_id=$2, category='PROGRESS', is_parent_visible=TRUE
     WHERE student_id=$1 AND created_at='2026-08-25' AND class_session_id IS NULL
  `, [namId, class7SessionId]);

  await pool.query(`
    INSERT INTO teacher_notes (student_id,class_session_id,note,category,is_parent_visible,author_name,created_at)
    SELECT $1,$2,$3,'HOMEWORK',TRUE,$4,'2026-08-24'
     WHERE NOT EXISTS (SELECT 1 FROM teacher_notes WHERE student_id=$1 AND created_at='2026-08-24')
  `, [minhId, class8SessionId, 'Minh cần hoàn thành bài đúng hạn và ôn lại cấu trúc câu cơ bản. Listening đang là kỹ năng cần ưu tiên.', env.demo.teacher.fullName]);
  await pool.query(`
    UPDATE teacher_notes SET class_session_id=$2, category='HOMEWORK', is_parent_visible=TRUE
     WHERE student_id=$1 AND created_at='2026-08-24' AND class_session_id IS NULL
  `, [minhId, class8SessionId]);

  for (const [studentId, date, status] of [
    [namId,'2026-08-11','PRESENT'],[namId,'2026-08-14','PRESENT'],[namId,'2026-08-18','LATE'],[namId,'2026-08-21','PRESENT'],[namId,'2026-08-25','PRESENT'],
    [minhId,'2026-08-10','PRESENT'],[minhId,'2026-08-13','ABSENT_EXCUSED'],[minhId,'2026-08-17','LATE'],[minhId,'2026-08-20','PRESENT'],[minhId,'2026-08-24','ABSENT']
  ]) {
    await pool.query(`INSERT INTO attendance_records (student_id,attendance_date,status) VALUES ($1,$2,$3) ON CONFLICT (student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status`, [studentId,date,status]);
  }

  const materialSeeds = [
    [classIds[7],'Unit 2','Grammar: Past Simple','PDF','2026-08-20'],
    [classIds[7],'Unit 2','Listening: Healthy Living','AUDIO','2026-08-23'],
    [classIds[7],'Unit 2','Vocabulary Flashcards','FLASHCARD','2026-08-24'],
    [classIds[8],'Unit 1','Reading: Teen Life','PDF','2026-08-20'],
    [classIds[8],'Unit 1','Vocabulary Review','FLASHCARD','2026-08-22'],
  ];
  for (const row of materialSeeds) {
    await pool.query(`INSERT INTO materials (class_id,unit_name,title,type,published_at) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=$1 AND title=$3)`, row);
  }

  console.log('Database initialized.');
  console.log(`Teacher: ${env.demo.teacher.email} / ${env.demo.teacher.password}`);
  console.log(`Student: ${env.demo.student.email} / ${env.demo.student.password}`);
  console.log(`Parent: ${env.demo.parent.email} / ${env.demo.parent.password}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => pool.end());
