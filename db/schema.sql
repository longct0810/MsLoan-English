BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_classes_grade_id ON classes(grade_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'HOMEWORK';

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

CREATE INDEX IF NOT EXISTS idx_assignments_class_id_due_at ON assignments(class_id, due_at);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_student ON student_scores(student_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_class ON materials(class_id, published_at DESC);

COMMIT;
