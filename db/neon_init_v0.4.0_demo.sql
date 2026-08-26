-- ============================================================================
-- English Classroom MVP v0.4.0 - base demo seed (v0.3 schema)
-- Neon PostgreSQL - Schema + Demo Data
--
-- Cách dùng:
--   1. Mở Neon Console -> SQL Editor.
--   2. Chọn database english_classroom.
--   3. Dán toàn bộ file này và Run.
--
-- Đặc điểm:
--   - Không DROP TABLE / không xóa dữ liệu đang có.
--   - Có thể chạy lại; dữ liệu demo chính được kiểm tra trước khi INSERT.
--   - Tạo mật khẩu demo bằng pgcrypto/bcrypt để tương thích bcryptjs của Node.js.
--
-- Tài khoản demo sau khi chạy:
--   Giáo viên : teacher@demo.local / Teacher@123
--   Học sinh  : student@demo.local / Student@123
--   Phụ huynh : parent@demo.local  / Parent@123
-- ============================================================================

BEGIN;

SET TIME ZONE 'Asia/Ho_Chi_Minh';

-- Dùng để sinh bcrypt hash cho tài khoản demo.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================================
-- 1. SCHEMA
-- ==========================================================================

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id BIGSERIAL PRIMARY KEY,
  grade_no SMALLINT NOT NULL UNIQUE CHECK (grade_no BETWEEN 1 AND 12),
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  grade_id BIGINT NOT NULL REFERENCES grades(id),
  teacher_id BIGINT REFERENCES users(id),
  school_year VARCHAR(20) NOT NULL,
  schedule_text VARCHAR(300),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  date_of_birth DATE,
  school VARCHAR(200),
  school_class VARCHAR(100),
  phone VARCHAR(30),
  email VARCHAR(200),
  parent_name VARCHAR(200),
  parent_phone VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_students (
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  left_at DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  PRIMARY KEY (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_progress_summary (
  student_id BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  average_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignments (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'HOMEWORK';

CREATE TABLE IF NOT EXISTS student_accounts (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_students (
  parent_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(50),
  PRIMARY KEY (parent_user_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
  score NUMERIC(4,2),
  submitted_at TIMESTAMPTZ,
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_scores (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  category VARCHAR(100),
  score NUMERIC(4,2) NOT NULL,
  max_score NUMERIC(4,2) NOT NULL DEFAULT 10,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS student_skills (
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill VARCHAR(50) NOT NULL,
  score NUMERIC(4,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, skill)
);

CREATE TABLE IF NOT EXISTS teacher_notes (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  author_name VARCHAR(200),
  created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS attendance_records (
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL,
  PRIMARY KEY (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS materials (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_name VARCHAR(150),
  title VARCHAR(250) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'PDF',
  published_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- v0.3.0: Buổi học.
CREATE TABLE IF NOT EXISTS class_sessions (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  topic VARCHAR(250),
  lesson_summary TEXT,
  homework TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v0.3.0: Điểm danh theo từng buổi học.
CREATE TABLE IF NOT EXISTS session_attendance (
  session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'ABSENT_EXCUSED', 'ONLINE')),
  note VARCHAR(500),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, student_id)
);

-- Mở rộng nhận xét học viên cho v0.3.0.
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS class_session_id BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL;
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS is_parent_visible BOOLEAN NOT NULL DEFAULT TRUE;

-- Indexes.
CREATE INDEX IF NOT EXISTS idx_classes_grade_id
  ON classes(grade_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id
  ON class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id_due_at
  ON assignments(class_id, due_at);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent
  ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_student
  ON student_scores(student_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_class
  ON materials(class_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date
  ON class_sessions(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_date
  ON class_sessions(teacher_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_attendance_student
  ON session_attendance(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_session
  ON teacher_notes(class_session_id, created_at DESC);

-- ==========================================================================
-- 2. DEMO DATA
-- ==========================================================================

DO $$
DECLARE
  v_school_year TEXT := '2026-2027';

  v_teacher_id BIGINT;
  v_student_user_id BIGINT;
  v_parent_user_id BIGINT;

  v_grade6_id BIGINT;
  v_grade7_id BIGINT;
  v_grade8_id BIGINT;
  v_grade9_id BIGINT;

  v_class6_id BIGINT;
  v_class7_id BIGINT;
  v_class8_id BIGINT;
  v_class9_id BIGINT;

  v_minh_anh_id BIGINT;
  v_gia_han_id BIGINT;
  v_nam_id BIGINT;
  v_khanh_linh_id BIGINT;
  v_duc_minh_id BIGINT;
  v_ngoc_mai_id BIGINT;
  v_quang_huy_id BIGINT;
  v_thu_trang_id BIGINT;

  v_class7_session_id BIGINT;
  v_class8_session_id BIGINT;
  v_class9_session_id BIGINT;

  v_assignment_id BIGINT;
BEGIN
  -- ------------------------------------------------------------------------
  -- Demo users. pgcrypto crypt(..., gen_salt('bf', 10)) tạo bcrypt hash.
  -- ------------------------------------------------------------------------
  INSERT INTO users (full_name, email, password_hash, role, status)
  VALUES (
    'Giáo viên Demo',
    'teacher@demo.local',
    crypt('Teacher@123', gen_salt('bf', 10)),
    'TEACHER',
    'ACTIVE'
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = 'TEACHER',
    status = 'ACTIVE',
    updated_at = NOW()
  RETURNING id INTO v_teacher_id;

  INSERT INTO users (full_name, email, password_hash, role, status)
  VALUES (
    'Lê Hoàng Nam',
    'student@demo.local',
    crypt('Student@123', gen_salt('bf', 10)),
    'STUDENT',
    'ACTIVE'
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = 'STUDENT',
    status = 'ACTIVE',
    updated_at = NOW()
  RETURNING id INTO v_student_user_id;

  INSERT INTO users (full_name, email, password_hash, role, status)
  VALUES (
    'Phụ huynh Demo',
    'parent@demo.local',
    crypt('Parent@123', gen_salt('bf', 10)),
    'PARENT',
    'ACTIVE'
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = 'PARENT',
    status = 'ACTIVE',
    updated_at = NOW()
  RETURNING id INTO v_parent_user_id;

  -- ------------------------------------------------------------------------
  -- Khối 6, 7, 8, 9.
  -- ------------------------------------------------------------------------
  INSERT INTO grades (grade_no, name) VALUES (6, 'Khối 6')
    ON CONFLICT (grade_no) DO UPDATE SET name = EXCLUDED.name;
  INSERT INTO grades (grade_no, name) VALUES (7, 'Khối 7')
    ON CONFLICT (grade_no) DO UPDATE SET name = EXCLUDED.name;
  INSERT INTO grades (grade_no, name) VALUES (8, 'Khối 8')
    ON CONFLICT (grade_no) DO UPDATE SET name = EXCLUDED.name;
  INSERT INTO grades (grade_no, name) VALUES (9, 'Khối 9')
    ON CONFLICT (grade_no) DO UPDATE SET name = EXCLUDED.name;

  SELECT id INTO v_grade6_id FROM grades WHERE grade_no = 6;
  SELECT id INTO v_grade7_id FROM grades WHERE grade_no = 7;
  SELECT id INTO v_grade8_id FROM grades WHERE grade_no = 8;
  SELECT id INTO v_grade9_id FROM grades WHERE grade_no = 9;

  -- ------------------------------------------------------------------------
  -- Lớp học.
  -- ------------------------------------------------------------------------
  SELECT id INTO v_class6_id
    FROM classes WHERE name = 'English 6 - T2/T5' AND school_year = v_school_year
    ORDER BY id LIMIT 1;
  IF v_class6_id IS NULL THEN
    INSERT INTO classes (name, grade_id, teacher_id, school_year, schedule_text)
    VALUES ('English 6 - T2/T5', v_grade6_id, v_teacher_id, v_school_year, 'Thứ 2, Thứ 5 • 17:30')
    RETURNING id INTO v_class6_id;
  ELSE
    UPDATE classes SET grade_id=v_grade6_id, teacher_id=v_teacher_id,
      schedule_text='Thứ 2, Thứ 5 • 17:30', status='ACTIVE'
    WHERE id=v_class6_id;
  END IF;

  SELECT id INTO v_class7_id
    FROM classes WHERE name = 'English 7 - T3/T6' AND school_year = v_school_year
    ORDER BY id LIMIT 1;
  IF v_class7_id IS NULL THEN
    INSERT INTO classes (name, grade_id, teacher_id, school_year, schedule_text)
    VALUES ('English 7 - T3/T6', v_grade7_id, v_teacher_id, v_school_year, 'Thứ 3, Thứ 6 • 17:30')
    RETURNING id INTO v_class7_id;
  ELSE
    UPDATE classes SET grade_id=v_grade7_id, teacher_id=v_teacher_id,
      schedule_text='Thứ 3, Thứ 6 • 17:30', status='ACTIVE'
    WHERE id=v_class7_id;
  END IF;

  SELECT id INTO v_class8_id
    FROM classes WHERE name = 'English 8 - T2/T5' AND school_year = v_school_year
    ORDER BY id LIMIT 1;
  IF v_class8_id IS NULL THEN
    INSERT INTO classes (name, grade_id, teacher_id, school_year, schedule_text)
    VALUES ('English 8 - T2/T5', v_grade8_id, v_teacher_id, v_school_year, 'Thứ 2, Thứ 5 • 19:00')
    RETURNING id INTO v_class8_id;
  ELSE
    UPDATE classes SET grade_id=v_grade8_id, teacher_id=v_teacher_id,
      schedule_text='Thứ 2, Thứ 5 • 19:00', status='ACTIVE'
    WHERE id=v_class8_id;
  END IF;

  SELECT id INTO v_class9_id
    FROM classes WHERE name = 'English 9 - T3/T6' AND school_year = v_school_year
    ORDER BY id LIMIT 1;
  IF v_class9_id IS NULL THEN
    INSERT INTO classes (name, grade_id, teacher_id, school_year, schedule_text)
    VALUES ('English 9 - T3/T6', v_grade9_id, v_teacher_id, v_school_year, 'Thứ 3, Thứ 6 • 19:00')
    RETURNING id INTO v_class9_id;
  ELSE
    UPDATE classes SET grade_id=v_grade9_id, teacher_id=v_teacher_id,
      schedule_text='Thứ 3, Thứ 6 • 19:00', status='ACTIVE'
    WHERE id=v_class9_id;
  END IF;

  -- ------------------------------------------------------------------------
  -- Học viên demo.
  -- ------------------------------------------------------------------------
  SELECT id INTO v_minh_anh_id FROM students
   WHERE full_name='Nguyễn Minh Anh' AND parent_phone='0900000001' ORDER BY id LIMIT 1;
  IF v_minh_anh_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Nguyễn Minh Anh', 'THCS Nguyễn Trãi', '6A2', '0900000001')
    RETURNING id INTO v_minh_anh_id;
  END IF;

  SELECT id INTO v_gia_han_id FROM students
   WHERE full_name='Trần Gia Hân' AND parent_phone='0900000002' ORDER BY id LIMIT 1;
  IF v_gia_han_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Trần Gia Hân', 'THCS Lê Lợi', '6A1', '0900000002')
    RETURNING id INTO v_gia_han_id;
  END IF;

  SELECT id INTO v_nam_id FROM students
   WHERE full_name='Lê Hoàng Nam' AND parent_phone='0900000003' ORDER BY id LIMIT 1;
  IF v_nam_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Lê Hoàng Nam', 'THCS Văn Quán', '7A3', '0900000003')
    RETURNING id INTO v_nam_id;
  END IF;

  SELECT id INTO v_khanh_linh_id FROM students
   WHERE full_name='Phạm Khánh Linh' AND parent_phone='0900000004' ORDER BY id LIMIT 1;
  IF v_khanh_linh_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Phạm Khánh Linh', 'THCS Mỗ Lao', '7A1', '0900000004')
    RETURNING id INTO v_khanh_linh_id;
  END IF;

  SELECT id INTO v_duc_minh_id FROM students
   WHERE full_name='Vũ Đức Minh' AND parent_phone='0900000005' ORDER BY id LIMIT 1;
  IF v_duc_minh_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Vũ Đức Minh', 'THCS Nguyễn Du', '8A4', '0900000005')
    RETURNING id INTO v_duc_minh_id;
  END IF;

  SELECT id INTO v_ngoc_mai_id FROM students
   WHERE full_name='Đỗ Ngọc Mai' AND parent_phone='0900000006' ORDER BY id LIMIT 1;
  IF v_ngoc_mai_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Đỗ Ngọc Mai', 'THCS Nguyễn Trãi', '8A2', '0900000006')
    RETURNING id INTO v_ngoc_mai_id;
  END IF;

  SELECT id INTO v_quang_huy_id FROM students
   WHERE full_name='Bùi Quang Huy' AND parent_phone='0900000007' ORDER BY id LIMIT 1;
  IF v_quang_huy_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Bùi Quang Huy', 'THCS Lê Quý Đôn', '9A1', '0900000007')
    RETURNING id INTO v_quang_huy_id;
  END IF;

  SELECT id INTO v_thu_trang_id FROM students
   WHERE full_name='Hoàng Thu Trang' AND parent_phone='0900000008' ORDER BY id LIMIT 1;
  IF v_thu_trang_id IS NULL THEN
    INSERT INTO students (full_name, school, school_class, parent_phone)
    VALUES ('Hoàng Thu Trang', 'THCS Văn Khê', '9A2', '0900000008')
    RETURNING id INTO v_thu_trang_id;
  END IF;

  -- Học viên thuộc lớp.
  INSERT INTO class_students (class_id, student_id) VALUES
    (v_class6_id, v_minh_anh_id),
    (v_class6_id, v_gia_han_id),
    (v_class7_id, v_nam_id),
    (v_class7_id, v_khanh_linh_id),
    (v_class8_id, v_duc_minh_id),
    (v_class8_id, v_ngoc_mai_id),
    (v_class9_id, v_quang_huy_id),
    (v_class9_id, v_thu_trang_id)
  ON CONFLICT (class_id, student_id) DO UPDATE SET status='ACTIVE', left_at=NULL;

  -- Tổng hợp tiến độ.
  INSERT INTO student_progress_summary (student_id, average_score, attendance_rate) VALUES
    (v_minh_anh_id, 8.6, 96),
    (v_gia_han_id, 7.8, 92),
    (v_nam_id, 7.1, 88),
    (v_khanh_linh_id, 9.0, 100),
    (v_duc_minh_id, 6.9, 84),
    (v_ngoc_mai_id, 8.2, 95),
    (v_quang_huy_id, 7.5, 90),
    (v_thu_trang_id, 8.8, 98)
  ON CONFLICT (student_id) DO UPDATE SET
    average_score=EXCLUDED.average_score,
    attendance_rate=EXCLUDED.attendance_rate,
    updated_at=NOW();

  -- Liên kết tài khoản học sinh và phụ huynh.
  INSERT INTO student_accounts (user_id, student_id)
  VALUES (v_student_user_id, v_nam_id)
  ON CONFLICT (user_id) DO UPDATE SET student_id=EXCLUDED.student_id;

  INSERT INTO parent_students (parent_user_id, student_id, relationship)
  VALUES
    (v_parent_user_id, v_nam_id, 'Bố/Mẹ'),
    (v_parent_user_id, v_duc_minh_id, 'Bố/Mẹ')
  ON CONFLICT (parent_user_id, student_id) DO UPDATE
    SET relationship=EXCLUDED.relationship;

  -- ------------------------------------------------------------------------
  -- Bài tập / bài kiểm tra demo.
  -- ------------------------------------------------------------------------
  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class6_id, 'Unit 1 - Vocabulary', NOW() + INTERVAL '2 day', 'PUBLISHED', v_teacher_id, 'HOMEWORK'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class6_id AND title='Unit 1 - Vocabulary'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class7_id, 'Unit 2 - Grammar', NOW() + INTERVAL '3 day', 'PUBLISHED', v_teacher_id, 'HOMEWORK'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class7_id AND title='Unit 2 - Grammar'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class8_id, 'Reading Practice', NOW() + INTERVAL '4 day', 'PUBLISHED', v_teacher_id, 'HOMEWORK'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class8_id AND title='Reading Practice'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class9_id, 'Exam Review', NOW() + INTERVAL '5 day', 'DRAFT', v_teacher_id, 'QUIZ'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class9_id AND title='Exam Review'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class7_id, 'Listening - Healthy Living', NOW() + INTERVAL '4 day', 'PUBLISHED', v_teacher_id, 'PRACTICE'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class7_id AND title='Listening - Healthy Living'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class7_id, 'Quiz Unit 2', NOW() + INTERVAL '6 day', 'PUBLISHED', v_teacher_id, 'QUIZ'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class7_id AND title='Quiz Unit 2'
  );

  INSERT INTO assignments (class_id, title, due_at, status, created_by, type)
  SELECT v_class8_id, 'Vocabulary Review', NOW() + INTERVAL '5 day', 'PUBLISHED', v_teacher_id, 'HOMEWORK'
  WHERE NOT EXISTS (
    SELECT 1 FROM assignments WHERE class_id=v_class8_id AND title='Vocabulary Review'
  );

  -- ------------------------------------------------------------------------
  -- Buổi học demo.
  -- ------------------------------------------------------------------------
  SELECT id INTO v_class7_session_id
    FROM class_sessions
   WHERE class_id=v_class7_id
     AND session_date=DATE '2026-08-25'
     AND topic='Unit 2 – Past Simple & Speaking'
   ORDER BY id LIMIT 1;

  IF v_class7_session_id IS NULL THEN
    INSERT INTO class_sessions
      (class_id, teacher_id, session_date, start_time, end_time, topic,
       lesson_summary, homework, status)
    VALUES
      (v_class7_id, v_teacher_id, DATE '2026-08-25', TIME '17:30', TIME '19:00',
       'Unit 2 – Past Simple & Speaking',
       'Ôn Past Simple, luyện hỏi đáp về hoạt động cuối tuần và speaking theo cặp.',
       'Workbook Unit 2 trang 24–25; luyện nghe 10 phút.',
       'COMPLETED')
    RETURNING id INTO v_class7_session_id;
  ELSE
    UPDATE class_sessions SET
      teacher_id=v_teacher_id,
      start_time=TIME '17:30',
      end_time=TIME '19:00',
      lesson_summary='Ôn Past Simple, luyện hỏi đáp về hoạt động cuối tuần và speaking theo cặp.',
      homework='Workbook Unit 2 trang 24–25; luyện nghe 10 phút.',
      status='COMPLETED',
      updated_at=NOW()
    WHERE id=v_class7_session_id;
  END IF;

  SELECT id INTO v_class8_session_id
    FROM class_sessions
   WHERE class_id=v_class8_id
     AND session_date=DATE '2026-08-26'
     AND topic='Unit 1 – Teen Life & Listening'
   ORDER BY id LIMIT 1;

  IF v_class8_session_id IS NULL THEN
    INSERT INTO class_sessions
      (class_id, teacher_id, session_date, start_time, end_time, topic,
       lesson_summary, homework, status)
    VALUES
      (v_class8_id, v_teacher_id, DATE '2026-08-26', TIME '19:00', TIME '20:30',
       'Unit 1 – Teen Life & Listening',
       'Reading ngắn, từ vựng Teen Life, nghe ý chính và thảo luận nhóm.',
       'Vocabulary Review và Listening Practice.',
       'IN_PROGRESS')
    RETURNING id INTO v_class8_session_id;
  ELSE
    UPDATE class_sessions SET
      teacher_id=v_teacher_id,
      start_time=TIME '19:00',
      end_time=TIME '20:30',
      lesson_summary='Reading ngắn, từ vựng Teen Life, nghe ý chính và thảo luận nhóm.',
      homework='Vocabulary Review và Listening Practice.',
      status='IN_PROGRESS',
      updated_at=NOW()
    WHERE id=v_class8_session_id;
  END IF;

  SELECT id INTO v_class9_session_id
    FROM class_sessions
   WHERE class_id=v_class9_id
     AND session_date=DATE '2026-08-27'
     AND topic='Exam Review – Grammar'
   ORDER BY id LIMIT 1;

  IF v_class9_session_id IS NULL THEN
    INSERT INTO class_sessions
      (class_id, teacher_id, session_date, start_time, end_time, topic,
       lesson_summary, homework, status)
    VALUES
      (v_class9_id, v_teacher_id, DATE '2026-08-27', TIME '19:00', TIME '20:30',
       'Exam Review – Grammar',
       'Ôn cấu trúc trọng tâm trước bài kiểm tra.',
       'Hoàn thành Exam Review.',
       'PLANNED')
    RETURNING id INTO v_class9_session_id;
  END IF;

  -- Điểm danh theo buổi.
  INSERT INTO session_attendance (session_id, student_id, status, note) VALUES
    (v_class7_session_id, v_nam_id, 'PRESENT', NULL),
    (v_class7_session_id, v_khanh_linh_id, 'PRESENT', NULL),
    (v_class8_session_id, v_duc_minh_id, 'LATE', 'Đến muộn 10 phút'),
    (v_class8_session_id, v_ngoc_mai_id, 'PRESENT', NULL)
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    status=EXCLUDED.status,
    note=EXCLUDED.note,
    marked_at=NOW();

  -- ------------------------------------------------------------------------
  -- Bài đã nộp / bài trễ.
  -- ------------------------------------------------------------------------
  SELECT id INTO v_assignment_id FROM assignments
   WHERE class_id=v_class7_id AND title='Unit 2 - Grammar'
   ORDER BY id LIMIT 1;
  IF v_assignment_id IS NOT NULL THEN
    INSERT INTO assignment_submissions
      (assignment_id, student_id, status, score, submitted_at)
    VALUES (v_assignment_id, v_nam_id, 'SUBMITTED', 8, NOW())
    ON CONFLICT (assignment_id, student_id) DO UPDATE SET
      status='SUBMITTED', score=8, submitted_at=NOW();
  END IF;

  SELECT id INTO v_assignment_id FROM assignments
   WHERE class_id=v_class8_id AND title='Reading Practice'
   ORDER BY id LIMIT 1;
  IF v_assignment_id IS NOT NULL THEN
    INSERT INTO assignment_submissions
      (assignment_id, student_id, status)
    VALUES (v_assignment_id, v_duc_minh_id, 'LATE')
    ON CONFLICT (assignment_id, student_id) DO UPDATE SET status='LATE';
  END IF;

  -- ------------------------------------------------------------------------
  -- Điểm học tập.
  -- ------------------------------------------------------------------------
  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_nam_id, 'Quiz Unit 1', 'Grammar', 7.5, 10, DATE '2026-08-05'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_nam_id AND title='Quiz Unit 1' AND recorded_at=DATE '2026-08-05');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_nam_id, 'Vocabulary Unit 1', 'Vocabulary', 8.2, 10, DATE '2026-08-10'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_nam_id AND title='Vocabulary Unit 1' AND recorded_at=DATE '2026-08-10');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_nam_id, 'Reading Practice', 'Reading', 7.0, 10, DATE '2026-08-16'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_nam_id AND title='Reading Practice' AND recorded_at=DATE '2026-08-16');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_nam_id, 'Speaking Check', 'Speaking', 6.4, 10, DATE '2026-08-21'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_nam_id AND title='Speaking Check' AND recorded_at=DATE '2026-08-21');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_nam_id, 'Unit 2 - Grammar', 'Grammar', 8.0, 10, DATE '2026-08-26'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_nam_id AND title='Unit 2 - Grammar' AND recorded_at=DATE '2026-08-26');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_duc_minh_id, 'Quiz Unit 1', 'Grammar', 6.5, 10, DATE '2026-08-06'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_duc_minh_id AND title='Quiz Unit 1' AND recorded_at=DATE '2026-08-06');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_duc_minh_id, 'Reading Practice', 'Reading', 7.2, 10, DATE '2026-08-15'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_duc_minh_id AND title='Reading Practice' AND recorded_at=DATE '2026-08-15');

  INSERT INTO student_scores (student_id, title, category, score, max_score, recorded_at)
  SELECT v_duc_minh_id, 'Listening Check', 'Listening', 6.0, 10, DATE '2026-08-23'
  WHERE NOT EXISTS (SELECT 1 FROM student_scores WHERE student_id=v_duc_minh_id AND title='Listening Check' AND recorded_at=DATE '2026-08-23');

  -- ------------------------------------------------------------------------
  -- Năng lực theo kỹ năng.
  -- ------------------------------------------------------------------------
  INSERT INTO student_skills (student_id, skill, score) VALUES
    (v_nam_id, 'Vocabulary', 7.8),
    (v_nam_id, 'Grammar', 7.2),
    (v_nam_id, 'Listening', 6.4),
    (v_nam_id, 'Speaking', 6.0),
    (v_nam_id, 'Reading', 7.6),
    (v_nam_id, 'Writing', 6.8),
    (v_duc_minh_id, 'Vocabulary', 7.0),
    (v_duc_minh_id, 'Grammar', 6.3),
    (v_duc_minh_id, 'Listening', 5.8),
    (v_duc_minh_id, 'Speaking', 6.2),
    (v_duc_minh_id, 'Reading', 7.1),
    (v_duc_minh_id, 'Writing', 6.0)
  ON CONFLICT (student_id, skill) DO UPDATE SET score=EXCLUDED.score;

  -- ------------------------------------------------------------------------
  -- Nhận xét giáo viên.
  -- ------------------------------------------------------------------------
  INSERT INTO teacher_notes
    (student_id, class_session_id, note, category, is_parent_visible, author_name, created_at)
  SELECT
    v_nam_id,
    v_class7_session_id,
    'Nam có tiến bộ ở Grammar. Cần luyện nghe 10–15 phút mỗi ngày và chủ động hơn trong phần Speaking.',
    'PROGRESS', TRUE, 'Giáo viên Demo', DATE '2026-08-25'
  WHERE NOT EXISTS (
    SELECT 1 FROM teacher_notes
    WHERE student_id=v_nam_id
      AND created_at=DATE '2026-08-25'
      AND note='Nam có tiến bộ ở Grammar. Cần luyện nghe 10–15 phút mỗi ngày và chủ động hơn trong phần Speaking.'
  );

  INSERT INTO teacher_notes
    (student_id, class_session_id, note, category, is_parent_visible, author_name, created_at)
  SELECT
    v_duc_minh_id,
    v_class8_session_id,
    'Minh cần hoàn thành bài đúng hạn và ôn lại cấu trúc câu cơ bản. Listening đang là kỹ năng cần ưu tiên.',
    'HOMEWORK', TRUE, 'Giáo viên Demo', DATE '2026-08-24'
  WHERE NOT EXISTS (
    SELECT 1 FROM teacher_notes
    WHERE student_id=v_duc_minh_id
      AND created_at=DATE '2026-08-24'
      AND note='Minh cần hoàn thành bài đúng hạn và ôn lại cấu trúc câu cơ bản. Listening đang là kỹ năng cần ưu tiên.'
  );

  -- ------------------------------------------------------------------------
  -- Lịch sử chuyên cần cũ (dùng cho portal/biểu đồ demo).
  -- ------------------------------------------------------------------------
  INSERT INTO attendance_records (student_id, attendance_date, status) VALUES
    (v_nam_id, DATE '2026-08-11', 'PRESENT'),
    (v_nam_id, DATE '2026-08-14', 'PRESENT'),
    (v_nam_id, DATE '2026-08-18', 'LATE'),
    (v_nam_id, DATE '2026-08-21', 'PRESENT'),
    (v_nam_id, DATE '2026-08-25', 'PRESENT'),
    (v_duc_minh_id, DATE '2026-08-10', 'PRESENT'),
    (v_duc_minh_id, DATE '2026-08-13', 'ABSENT_EXCUSED'),
    (v_duc_minh_id, DATE '2026-08-17', 'LATE'),
    (v_duc_minh_id, DATE '2026-08-20', 'PRESENT'),
    (v_duc_minh_id, DATE '2026-08-24', 'ABSENT')
  ON CONFLICT (student_id, attendance_date) DO UPDATE SET status=EXCLUDED.status;

  -- ------------------------------------------------------------------------
  -- Tài liệu học tập.
  -- ------------------------------------------------------------------------
  INSERT INTO materials (class_id, unit_name, title, type, published_at)
  SELECT v_class7_id, 'Unit 2', 'Grammar: Past Simple', 'PDF', DATE '2026-08-20'
  WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=v_class7_id AND title='Grammar: Past Simple');

  INSERT INTO materials (class_id, unit_name, title, type, published_at)
  SELECT v_class7_id, 'Unit 2', 'Listening: Healthy Living', 'AUDIO', DATE '2026-08-23'
  WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=v_class7_id AND title='Listening: Healthy Living');

  INSERT INTO materials (class_id, unit_name, title, type, published_at)
  SELECT v_class7_id, 'Unit 2', 'Vocabulary Flashcards', 'FLASHCARD', DATE '2026-08-24'
  WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=v_class7_id AND title='Vocabulary Flashcards');

  INSERT INTO materials (class_id, unit_name, title, type, published_at)
  SELECT v_class8_id, 'Unit 1', 'Reading: Teen Life', 'PDF', DATE '2026-08-20'
  WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=v_class8_id AND title='Reading: Teen Life');

  INSERT INTO materials (class_id, unit_name, title, type, published_at)
  SELECT v_class8_id, 'Unit 1', 'Vocabulary Review', 'FLASHCARD', DATE '2026-08-22'
  WHERE NOT EXISTS (SELECT 1 FROM materials WHERE class_id=v_class8_id AND title='Vocabulary Review');

END $$;

COMMIT;

-- ==========================================================================
-- 3. VERIFY
-- ============================================================================

SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM grades) AS grades,
  (SELECT COUNT(*) FROM classes) AS classes,
  (SELECT COUNT(*) FROM students) AS students,
  (SELECT COUNT(*) FROM assignments) AS assignments,
  (SELECT COUNT(*) FROM class_sessions) AS class_sessions,
  (SELECT COUNT(*) FROM session_attendance) AS session_attendance,
  (SELECT COUNT(*) FROM teacher_notes) AS teacher_notes,
  (SELECT COUNT(*) FROM materials) AS materials;

SELECT id, full_name, email, role, status
FROM users
WHERE email IN ('teacher@demo.local', 'student@demo.local', 'parent@demo.local')
ORDER BY role;


-- ============================================================================
-- 4. UPGRADE TO v0.4.0
-- ============================================================================

-- English Classroom MVP v0.4.0
-- Upgrade script for Neon PostgreSQL from v0.3.x.
-- Safe design: no DROP TABLE, no DELETE.

BEGIN;

CREATE TABLE IF NOT EXISTS lessons (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  unit_name VARCHAR(150),
  summary TEXT,
  content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE materials ADD COLUMN IF NOT EXISTS lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score NUMERIC(6,2) NOT NULL DEFAULT 10;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_text TEXT;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE student_scores ADD COLUMN IF NOT EXISTS assignment_id BIGINT REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_class_status ON lessons(class_id, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_materials_lesson ON materials(lesson_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_lesson ON assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(student_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_assignment
  ON student_scores(student_id, assignment_id)
  WHERE assignment_id IS NOT NULL;

-- Demo lesson seeds. These INSERTs only run if the matching demo class exists.
INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 1', 'My New School',
       'Từ vựng trường học, giới thiệu bản thân và cấu trúc hiện tại đơn.',
       'Ôn từ vựng về trường học, luyện giới thiệu lớp học và thực hành Present Simple.',
       'PUBLISHED', 1,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 6 - T2/T5'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='My New School');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 2', 'Healthy Living',
       'Past Simple, thói quen tốt và luyện nghe.',
       'Học sinh luyện Past Simple qua tình huống cuối tuần, sau đó nghe đoạn hội thoại về healthy habits.',
       'PUBLISHED', 2,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 7 - T3/T6'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Healthy Living');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by, published_at)
SELECT c.id, 'Unit 1', 'Teen Life',
       'Reading, vocabulary và listening theo chủ đề đời sống tuổi teen.',
       'Đọc hiểu ngắn, mở rộng từ vựng và luyện nghe lấy ý chính.',
       'PUBLISHED', 1,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1), NOW()
  FROM classes c
 WHERE c.name='English 8 - T2/T5'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Teen Life');

INSERT INTO lessons (class_id, unit_name, title, summary, content, status, sort_order, created_by)
SELECT c.id, 'Review', 'Grammar Exam Review',
       'Ôn tập ngữ pháp trọng tâm trước bài kiểm tra.',
       'Tổng hợp cấu trúc và lỗi thường gặp.',
       'DRAFT', 99,
       (SELECT id FROM users WHERE role='TEACHER' ORDER BY id LIMIT 1)
  FROM classes c
 WHERE c.name='English 9 - T3/T6'
   AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.class_id=c.id AND l.title='Grammar Exam Review');

-- Link existing demo assignments to lessons without changing user-created records.
UPDATE assignments a
   SET lesson_id = l.id,
       description = COALESCE(NULLIF(a.description,''), 'Luyện Past Simple.'),
       instructions = COALESCE(NULLIF(a.instructions,''), 'Viết 10 câu về hoạt động cuối tuần bằng Past Simple.'),
       published_at = CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Unit 2 - Grammar' AND l.title='Healthy Living';

UPDATE assignments a
   SET lesson_id = l.id,
       description = COALESCE(NULLIF(a.description,''), 'Bài đọc Teen Life.'),
       instructions = COALESCE(NULLIF(a.instructions,''), 'Đọc đoạn văn và trả lời câu hỏi bằng câu đầy đủ.'),
       published_at = CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Reading Practice' AND l.title='Teen Life';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title IN ('Listening - Healthy Living','Quiz Unit 2') AND l.title='Healthy Living';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Vocabulary Review' AND l.title='Teen Life';

UPDATE assignments a
   SET lesson_id=l.id, published_at=CASE WHEN a.status='PUBLISHED' THEN COALESCE(a.published_at,NOW()) ELSE a.published_at END
  FROM lessons l
 WHERE a.class_id=l.class_id AND a.title='Unit 1 - Vocabulary' AND l.title='My New School';

-- Link existing demo materials to their lessons. Existing URL remains unchanged.
UPDATE materials m SET lesson_id=l.id, status=COALESCE(NULLIF(m.status,''),'PUBLISHED')
  FROM lessons l
 WHERE m.class_id=l.class_id AND m.unit_name='Unit 2' AND l.title='Healthy Living';

UPDATE materials m SET lesson_id=l.id, status=COALESCE(NULLIF(m.status,''),'PUBLISHED')
  FROM lessons l
 WHERE m.class_id=l.class_id AND m.unit_name='Unit 1' AND l.title='Teen Life';

COMMIT;

-- Verification
SELECT 'lessons' AS entity, COUNT(*) AS total FROM lessons
UNION ALL SELECT 'materials', COUNT(*) FROM materials
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'assignment_submissions', COUNT(*) FROM assignment_submissions;
