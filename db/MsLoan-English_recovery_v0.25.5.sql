-- ============================================================================
-- MsLoan-English database recovery bundle
-- Reconstructed from repository schema/migrations through v0.25.5
-- Generated for disaster recovery when the Neon database is unavailable.
--
-- IMPORTANT:
--   * This file reconstructs DATABASE STRUCTURE and repository-managed seed/config
--     data only.
--   * It CANNOT recreate live production rows that existed only in Neon
--     (students, scores, attendance, tuition transactions, sync history, etc.)
--     unless those rows were previously committed/exported elsewhere.
--   * Run on an EMPTY PostgreSQL database.
--
-- Included source files, in execution order:
--   1. db/schema.sql                    (combined schema through v0.25.0)
--   2. db/neon_upgrade_v0.25.2.sql     (tuition transfer content update)
--   3. sql/upgrade_v0.25.4.sql         (Google Sheets score dedup hotfix)
--   4. sql/upgrade_v0.25.5.sql         (Google Sheets auto-sync every 3 days)
-- ============================================================================



-- ============================================================================
-- BEGIN SOURCE: db/schema.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(200) UNIQUE,
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
  student_code VARCHAR(40) UNIQUE,
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
  score NUMERIC(8,2),
  submitted_at TIMESTAMPTZ,
  PRIMARY KEY (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_scores (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  category VARCHAR(100),
  score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 10,
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

CREATE TABLE IF NOT EXISTS parent_notification_reads (
  parent_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key VARCHAR(500) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_parent_notification_reads_parent
  ON parent_notification_reads(parent_user_id, read_at DESC);


-- v0.3.0 - Class sessions, attendance and session-linked student notes.
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

CREATE TABLE IF NOT EXISTS session_attendance (
  session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'PRESENT'
    CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'ABSENT_EXCUSED', 'ONLINE')),
  note VARCHAR(500),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, student_id)
);

ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS class_session_id BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL;
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS is_parent_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date
  ON class_sessions(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_date
  ON class_sessions(teacher_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_attendance_student
  ON session_attendance(student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_session
  ON teacher_notes(class_session_id, created_at DESC);

COMMIT;

-- v0.4.0 - Lessons, richer materials, assignment submission and grading workflow.
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

COMMIT;

-- v0.5.0 - Question bank, online exams, attempts, autosave and auto grading.
BEGIN;

CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  grade_id BIGINT REFERENCES grades(id) ON DELETE SET NULL,
  lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  question_type VARCHAR(30) NOT NULL
    CHECK (question_type IN ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK')),
  stem TEXT NOT NULL,
  correct_answer TEXT,
  explanation TEXT,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
    CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  default_points NUMERIC(6,2) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_options (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key VARCHAR(10) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, option_key)
);

CREATE TABLE IF NOT EXISTS exams (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title VARCHAR(250) NOT NULL,
  description TEXT,
  instructions TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 1 AND 360),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
  show_result BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  points NUMERIC(6,2) NOT NULL DEFAULT 1,
  PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  last_saved_at TIMESTAMPTZ,
  score NUMERIC(8,2),
  max_score NUMERIC(8,2),
  UNIQUE (exam_id, student_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS exam_answers (
  attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id BIGINT REFERENCES question_options(id) ON DELETE SET NULL,
  answer_text TEXT,
  is_correct BOOLEAN,
  awarded_score NUMERIC(8,2),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id)
);

ALTER TABLE student_scores ADD COLUMN IF NOT EXISTS exam_id BIGINT REFERENCES exams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_questions_grade_status ON questions(grade_id, status, question_type, difficulty);
CREATE INDEX IF NOT EXISTS idx_question_options_question ON question_options(question_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_exams_class_status ON exams(class_id, status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_order ON exam_questions(exam_id, sort_order, question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id, exam_id, attempt_no DESC);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_status ON exam_attempts(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(attempt_id, question_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_exam
  ON student_scores(student_id, exam_id)
  WHERE exam_id IS NOT NULL;

COMMIT;

-- v0.6.0 - Bulk question import support at application layer and mixed auto/manual grading.
BEGIN;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_question_type_check
  CHECK (question_type IN ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'ESSAY'));
ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_status_check
  CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'PENDING_GRADING', 'GRADED'));
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS auto_score NUMERIC(8,2);
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS grading_status VARCHAR(30) NOT NULL DEFAULT 'NOT_GRADED';
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS graded_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
ALTER TABLE exam_answers DROP CONSTRAINT IF EXISTS exam_answers_grading_status_check;
ALTER TABLE exam_answers ADD CONSTRAINT exam_answers_grading_status_check
  CHECK (grading_status IN ('NOT_GRADED', 'AUTO_GRADED', 'PENDING_MANUAL', 'MANUALLY_GRADED'));
CREATE INDEX IF NOT EXISTS idx_exam_attempts_pending_grading ON exam_attempts(exam_id, status) WHERE status='PENDING_GRADING';
CREATE INDEX IF NOT EXISTS idx_exam_answers_grading_status ON exam_answers(attempt_id, grading_status);
COMMIT;

-- v0.7.0 - Student/Class CRUD, linked parent accounts and safe soft-delete metadata.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_students_active ON students(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role_email ON users(role, LOWER(email));
COMMIT;


-- v0.14.0 - Ownership hardening support and score precision.
BEGIN;
ALTER TABLE assignment_submissions
  ALTER COLUMN score TYPE NUMERIC(8,2) USING score::NUMERIC(8,2);
ALTER TABLE student_scores
  ALTER COLUMN score TYPE NUMERIC(8,2) USING score::NUMERIC(8,2),
  ALTER COLUMN max_score TYPE NUMERIC(8,2) USING max_score::NUMERIC(8,2);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_active
  ON classes(teacher_id, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_class_students_active_student_class
  ON class_students(student_id, class_id) WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS idx_questions_created_by
  ON questions(created_by, id);
COMMIT;

-- v0.15.0 - Teacher Report Center and class-scoped score reporting.
BEGIN;
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS class_id BIGINT REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_student_scores_class_recorded
  ON student_scores(class_id, recorded_at DESC, student_id)
  WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_submitted
  ON exam_attempts(student_id, submitted_at DESC)
  WHERE submitted_at IS NOT NULL;
COMMIT;

-- v0.16.0 - Electronic class journal / session log.
BEGIN;

-- v0.16.0 - Electronic class journal / session log.
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS session_goal TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS teacher_summary TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS parent_summary TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS next_session_plan TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS parent_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_sessions_completed
  ON class_sessions(class_id, completed_at DESC)
  WHERE status='COMPLETED';

COMMIT;

-- v0.17.0 - Skill Tracking.
BEGIN;

-- v0.17.0 - Skill Tracking.
CREATE TABLE IF NOT EXISTS skills (
  code VARCHAR(40) PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO skills(code,label,sort_order) VALUES
 ('VOCABULARY','Vocabulary',10),('GRAMMAR','Grammar',20),('READING','Reading',30),
 ('LISTENING','Listening',40),('WRITING','Writing',50),('SPEAKING','Speaking',60),
 ('PRONUNCIATION','Pronunciation',70)
ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order,is_active=TRUE;

CREATE TABLE IF NOT EXISTS assignment_skills (
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  PRIMARY KEY(assignment_id,skill_code)
);

CREATE TABLE IF NOT EXISTS question_skills (
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  PRIMARY KEY(question_id,skill_code)
);

CREATE TABLE IF NOT EXISTS student_skill_events (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id BIGINT REFERENCES classes(id) ON DELETE SET NULL,
  skill_code VARCHAR(40) NOT NULL REFERENCES skills(code),
  source_type VARCHAR(20) NOT NULL CHECK(source_type IN ('LEGACY','ASSIGNMENT','EXAM','MANUAL')),
  source_id BIGINT NOT NULL DEFAULT 0,
  score NUMERIC(8,2) NOT NULL,
  max_score NUMERIC(8,2) NOT NULL CHECK(max_score > 0),
  weight NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK(weight > 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_skill_event_source
  ON student_skill_events(student_id,skill_code,source_type,source_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_events_student_date
  ON student_skill_events(student_id,skill_code,recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_skill_events_class_date
  ON student_skill_events(class_id,skill_code,recorded_at DESC) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_skill_events_student_class_skill_date
  ON student_skill_events(student_id,class_id,skill_code,recorded_at DESC,id DESC);

-- Preserve the old student_skills data as an initial baseline.
INSERT INTO student_skill_events(student_id,class_id,skill_code,source_type,source_id,score,max_score,weight,recorded_at)
SELECT ss.student_id,
       (SELECT MIN(cs.class_id) FROM class_students cs WHERE cs.student_id=ss.student_id AND cs.status='ACTIVE'
         HAVING COUNT(*)=1),
       UPPER(ss.skill),'LEGACY',0,ss.score,10,0.5,NOW()
  FROM student_skills ss
  JOIN skills sk ON sk.code=UPPER(ss.skill)
ON CONFLICT(student_id,skill_code,source_type,source_id) DO NOTHING;

COMMIT;

-- v0.18.0 - Assignment 2.0.
BEGIN;

-- v0.18.0 - Assignment 2.0: file/audio submissions and skill rubric grading.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_mode VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_submission_mode_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_submission_mode_check CHECK(submission_mode IN ('TEXT','FILE','AUDIO','MIXED'));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS rubric_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS rubric_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS rubric_feedback TEXT;

CREATE TABLE IF NOT EXISTS assignment_submission_assets (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes >= 0),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_assignment_submission_asset FOREIGN KEY(assignment_id,student_id)
    REFERENCES assignment_submissions(assignment_id,student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assignment_submission_assets_submission
  ON assignment_submission_assets(assignment_id,student_id,created_at);

COMMIT;

-- v0.19.0 - Exam 2.0: pools, randomization, immutable snapshots and student overrides.
BEGIN;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS selection_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS randomize_questions BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS randomize_options BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_score_percent NUMERIC(5,2) NOT NULL DEFAULT 50;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_selection_mode_check;
ALTER TABLE exams ADD CONSTRAINT exams_selection_mode_check CHECK(selection_mode IN ('MANUAL','POOL'));
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_pass_score_percent_check;
ALTER TABLE exams ADD CONSTRAINT exams_pass_score_percent_check CHECK(pass_score_percent BETWEEN 0 AND 100);
CREATE TABLE IF NOT EXISTS exam_pool_rules (id BIGSERIAL PRIMARY KEY,exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE RESTRICT,difficulty VARCHAR(20),question_type VARCHAR(30),question_count INTEGER NOT NULL CHECK(question_count BETWEEN 1 AND 200),sort_order INTEGER NOT NULL DEFAULT 0);
ALTER TABLE exam_pool_rules DROP CONSTRAINT IF EXISTS exam_pool_rules_difficulty_check;
ALTER TABLE exam_pool_rules ADD CONSTRAINT exam_pool_rules_difficulty_check CHECK(difficulty IS NULL OR difficulty IN ('EASY','MEDIUM','HARD'));
ALTER TABLE exam_pool_rules DROP CONSTRAINT IF EXISTS exam_pool_rules_question_type_check;
ALTER TABLE exam_pool_rules ADD CONSTRAINT exam_pool_rules_question_type_check CHECK(question_type IS NULL OR question_type IN ('MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK','ESSAY'));
CREATE INDEX IF NOT EXISTS idx_exam_pool_rules_exam ON exam_pool_rules(exam_id,sort_order,id);
CREATE TABLE IF NOT EXISTS exam_question_snapshots (exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,question_id BIGINT NOT NULL,question_type VARCHAR(30) NOT NULL,stem TEXT NOT NULL,correct_answer TEXT,explanation TEXT,difficulty VARCHAR(20),points NUMERIC(8,2) NOT NULL CHECK(points >= 0),sort_order INTEGER NOT NULL DEFAULT 0,options JSONB NOT NULL DEFAULT '[]'::jsonb,skill_codes JSONB NOT NULL DEFAULT '[]'::jsonb,snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(exam_id,question_id));
CREATE INDEX IF NOT EXISTS idx_exam_question_snapshots_order ON exam_question_snapshots(exam_id,sort_order,question_id);
CREATE TABLE IF NOT EXISTS exam_attempt_questions (attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,question_id BIGINT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,option_order JSONB NOT NULL DEFAULT '[]'::jsonb,PRIMARY KEY(attempt_id,question_id));
CREATE INDEX IF NOT EXISTS idx_exam_attempt_questions_order ON exam_attempt_questions(attempt_id,sort_order,question_id);
CREATE TABLE IF NOT EXISTS exam_student_overrides (exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,extra_minutes INTEGER NOT NULL DEFAULT 0 CHECK(extra_minutes BETWEEN 0 AND 1440),max_attempts_override INTEGER CHECK(max_attempts_override BETWEEN 1 AND 20),reopen_until TIMESTAMPTZ,is_enabled BOOLEAN NOT NULL DEFAULT TRUE,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(exam_id,student_id));
CREATE INDEX IF NOT EXISTS idx_exam_student_overrides_student ON exam_student_overrides(student_id,exam_id) WHERE is_enabled=TRUE;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS effective_duration_minutes INTEGER;
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS selected_option_key VARCHAR(20);
COMMIT;

-- v0.20.0 - Google Sheets Data Source / Teacher Tracking Sync.
BEGIN;

-- ==========================================================
-- 1. EXTERNAL DATA SOURCES
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_data_sources (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_SHEETS',
  name VARCHAR(250) NOT NULL,
  spreadsheet_id VARCHAR(200) NOT NULL,
  sheet_gid VARCHAR(50) NOT NULL DEFAULT '0',
  source_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (sync_interval_minutes BETWEEN 5 AND 1440),
  import_from_date DATE,
  import_to_date DATE,
  last_content_hash VARCHAR(64),
  last_synced_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_data_sources_provider_check
    CHECK (provider IN ('GOOGLE_SHEETS')),
  CONSTRAINT external_data_sources_date_window_check
    CHECK (import_to_date IS NULL OR import_from_date IS NULL OR import_to_date >= import_from_date),
  UNIQUE (teacher_id, class_id, provider, spreadsheet_id, sheet_gid)
);

CREATE INDEX IF NOT EXISTS idx_external_data_sources_due
  ON external_data_sources(enabled, last_synced_at, sync_interval_minutes);
CREATE INDEX IF NOT EXISTS idx_external_data_sources_teacher
  ON external_data_sources(teacher_id, class_id, enabled);

-- ==========================================================
-- 2. SYNC RUN HISTORY
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  content_hash VARCHAR(64),
  rows_read INTEGER NOT NULL DEFAULT 0,
  students_seen INTEGER NOT NULL DEFAULT 0,
  students_matched INTEGER NOT NULL DEFAULT 0,
  observations_seen INTEGER NOT NULL DEFAULT 0,
  observations_inserted INTEGER NOT NULL DEFAULT 0,
  observations_updated INTEGER NOT NULL DEFAULT 0,
  materialized_scores INTEGER NOT NULL DEFAULT 0,
  materialized_attendance INTEGER NOT NULL DEFAULT 0,
  materialized_notes INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT external_sync_runs_status_check
    CHECK (status IN ('RUNNING','SUCCESS','NO_CHANGE','PARTIAL','FAILED','LOCKED')),
  CONSTRAINT external_sync_runs_trigger_check
    CHECK (trigger_type IN ('SCHEDULED','MANUAL','CLI'))
);

CREATE INDEX IF NOT EXISTS idx_external_sync_runs_source_started
  ON external_sync_runs(source_id, started_at DESC);

-- ==========================================================
-- 3. EXTERNAL STUDENT -> INTERNAL STUDENT MAPPING
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_student_links (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  external_student_key VARCHAR(250) NOT NULL,
  external_student_name VARCHAR(250) NOT NULL,
  external_row_hint VARCHAR(100),
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  match_status VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
  match_method VARCHAR(30),
  confidence NUMERIC(5,2),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_student_links_match_status_check
    CHECK (match_status IN ('MATCHED','UNMATCHED','AMBIGUOUS','IGNORED')),
  UNIQUE (source_id, external_student_key)
);

CREATE INDEX IF NOT EXISTS idx_external_student_links_student
  ON external_student_links(student_id, source_id)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_student_links_unmatched
  ON external_student_links(source_id, match_status)
  WHERE match_status <> 'MATCHED';

-- ==========================================================
-- 4. RAW / NORMALIZED OBSERVATIONS
-- Every non-empty teacher cell is preserved here before it is
-- optionally materialized into core business tables.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_observations (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  sync_run_id BIGINT REFERENCES external_sync_runs(id) ON DELETE SET NULL,
  external_student_key VARCHAR(250) NOT NULL,
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  observed_on DATE,
  source_column_index INTEGER NOT NULL,
  field_name TEXT,
  observation_type VARCHAR(30) NOT NULL,
  skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE SET NULL,
  raw_value TEXT NOT NULL,
  numeric_value NUMERIC(12,4),
  max_value NUMERIC(12,4),
  normalized_status VARCHAR(50),
  observation_key VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  warning TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_observations_type_check
    CHECK (observation_type IN ('SCORE','ATTENDANCE','LEVEL','HOMEWORK_STATUS','NOTE','TEXT')),
  UNIQUE (source_id, observation_key)
);

CREATE INDEX IF NOT EXISTS idx_external_observations_student_date
  ON external_observations(student_id, observed_on DESC)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_observations_source_date
  ON external_observations(source_id, observed_on DESC, observation_type);
CREATE INDEX IF NOT EXISTS idx_external_observations_unmatched
  ON external_observations(source_id, external_student_key)
  WHERE student_id IS NULL;

-- ==========================================================
-- 5. SHEET DATE -> CLASS SESSION MAPPING
-- Avoids accidentally attaching attendance to the wrong session.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_session_links (
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,
  class_session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  link_method VARCHAR(30) NOT NULL DEFAULT 'AUTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_id, observed_on),
  CONSTRAINT external_session_links_method_check
    CHECK (link_method IN ('AUTO','MANUAL','CREATED_BY_SYNC'))
);

CREATE INDEX IF NOT EXISTS idx_external_session_links_session
  ON external_session_links(class_session_id);

-- ==========================================================
-- 6. SOURCE TRACEABILITY ON CORE TABLES
-- Existing rows stay MANUAL and are never deleted by this sync.
-- ==========================================================
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_source_ref
  ON student_scores(student_id, source_type, source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_notes_source_ref
  ON teacher_notes(student_id, source_type, source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- v0.17.0 restricted skill event sources to legacy/internal sources.
-- Extend it for safe traceable external events.
ALTER TABLE student_skill_events
  DROP CONSTRAINT IF EXISTS student_skill_events_source_type_check;
ALTER TABLE student_skill_events
  ADD CONSTRAINT student_skill_events_source_type_check
  CHECK(source_type IN ('LEGACY','ASSIGNMENT','EXAM','MANUAL','EXTERNAL'));

COMMIT;

-- ==========================================================
-- v0.21.0 - Google Sheets Assessment Mapping
-- ==========================================================
BEGIN;

CREATE TABLE IF NOT EXISTS external_assessments (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  external_assessment_key VARCHAR(64) NOT NULL,
  observed_on DATE,
  title VARCHAR(500) NOT NULL,
  assessment_type VARCHAR(30) NOT NULL DEFAULT 'TEST',
  skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE SET NULL,
  raw_max_score NUMERIC(12,4),
  normalized_max_score NUMERIC(12,4) NOT NULL DEFAULT 10,
  source_column_start INTEGER NOT NULL,
  source_column_end INTEGER NOT NULL,
  mapping_type VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL',
  exam_id BIGINT REFERENCES exams(id) ON DELETE SET NULL,
  assignment_id BIGINT REFERENCES assignments(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_assessments_type_check CHECK (assessment_type IN ('TEST','QUIZ','PRACTICE','OTHER')),
  CONSTRAINT external_assessments_mapping_type_check CHECK (mapping_type IN ('EXTERNAL','EXAM','ASSIGNMENT')),
  CONSTRAINT external_assessments_status_check CHECK (status IN ('ACTIVE','IGNORED')),
  CONSTRAINT external_assessments_mapping_target_check CHECK (
    (mapping_type='EXTERNAL' AND exam_id IS NULL AND assignment_id IS NULL) OR
    (mapping_type='EXAM' AND exam_id IS NOT NULL AND assignment_id IS NULL) OR
    (mapping_type='ASSIGNMENT' AND assignment_id IS NOT NULL AND exam_id IS NULL)
  ),
  UNIQUE (source_id, external_assessment_key)
);
CREATE INDEX IF NOT EXISTS idx_external_assessments_source_date ON external_assessments(source_id, observed_on DESC, source_column_start);
CREATE INDEX IF NOT EXISTS idx_external_assessments_exam ON external_assessments(exam_id) WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_assessments_assignment ON external_assessments(assignment_id) WHERE assignment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS external_assessment_results (
  id BIGSERIAL PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES external_assessments(id) ON DELETE CASCADE,
  sync_run_id BIGINT REFERENCES external_sync_runs(id) ON DELETE SET NULL,
  external_student_key VARCHAR(250) NOT NULL,
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  primary_observation_id BIGINT REFERENCES external_observations(id) ON DELETE SET NULL,
  raw_score NUMERIC(12,4),
  raw_max_score NUMERIC(12,4),
  normalized_score NUMERIC(12,4),
  normalized_max_score NUMERIC(12,4) NOT NULL DEFAULT 10,
  confidence NUMERIC(5,2),
  detection_mode VARCHAR(60),
  warning TEXT,
  raw_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_assessment_results_score_check CHECK (raw_max_score IS NULL OR raw_max_score > 0),
  CONSTRAINT external_assessment_results_normalized_check CHECK (normalized_max_score > 0),
  UNIQUE (assessment_id, external_student_key)
);
CREATE INDEX IF NOT EXISTS idx_external_assessment_results_student ON external_assessment_results(student_id, assessment_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_assessment_results_warning ON external_assessment_results(assessment_id) WHERE warning IS NOT NULL;

ALTER TABLE external_sync_runs ADD COLUMN IF NOT EXISTS assessments_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE external_sync_runs ADD COLUMN IF NOT EXISTS assessment_results_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE external_sync_runs ADD COLUMN IF NOT EXISTS materialized_assessment_results INTEGER NOT NULL DEFAULT 0;

COMMIT;



-- English Classroom v0.23.0
-- Tuition Billing & QR Payment
-- Baseline: v0.22.0

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_payment_settings (
  teacher_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(120) NOT NULL,
  bank_code VARCHAR(30),
  bank_bin VARCHAR(20) NOT NULL,
  bank_account_no VARCHAR(60) NOT NULL,
  bank_account_name VARCHAR(200) NOT NULL,
  qr_provider VARCHAR(30) NOT NULL DEFAULT 'VIETQR_IMAGE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_payment_settings_provider_check
    CHECK (qr_provider IN ('VIETQR_IMAGE'))
);

CREATE TABLE IF NOT EXISTS tuition_plans (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  billing_type VARCHAR(30) NOT NULL DEFAULT 'PER_SESSION',
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  billed_statuses JSONB NOT NULL DEFAULT '["PRESENT","LATE","ONLINE"]'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_plans_billing_type_check
    CHECK (billing_type IN ('PER_SESSION')),
  CONSTRAINT tuition_plans_effective_window_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tuition_plans_active_class
  ON tuition_plans(class_id)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_tuition_plans_teacher_class
  ON tuition_plans(teacher_id, class_id, is_active);

CREATE TABLE IF NOT EXISTS tuition_cycles (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES tuition_plans(id) ON DELETE RESTRICT,
  period_month DATE NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_cycles_status_check
    CHECK (status IN ('DRAFT','SENT','CLOSED','CANCELLED')),
  CONSTRAINT tuition_cycles_date_check
    CHECK (to_date >= from_date),
  UNIQUE(class_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tuition_cycles_teacher_month
  ON tuition_cycles(teacher_id, period_month DESC, class_id);

CREATE TABLE IF NOT EXISTS tuition_invoices (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES tuition_cycles(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES tuition_plans(id) ON DELETE RESTRICT,
  public_code VARCHAR(60) UNIQUE,
  transfer_code VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  due_date DATE NOT NULL,
  attendance_present INTEGER NOT NULL DEFAULT 0 CHECK (attendance_present >= 0),
  attendance_late INTEGER NOT NULL DEFAULT 0 CHECK (attendance_late >= 0),
  attendance_online INTEGER NOT NULL DEFAULT 0 CHECK (attendance_online >= 0),
  attendance_absent INTEGER NOT NULL DEFAULT 0 CHECK (attendance_absent >= 0),
  attendance_excused INTEGER NOT NULL DEFAULT 0 CHECK (attendance_excused >= 0),
  billable_sessions INTEGER NOT NULL DEFAULT 0 CHECK (billable_sessions >= 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  other_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (other_fee_amount >= 0),
  final_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (final_amount >= 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  note TEXT,
  plan_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_invoices_status_check
    CHECK (status IN ('DRAFT','UNPAID','PARTIAL','PAID','CANCELLED')),
  CONSTRAINT tuition_invoices_amount_check
    CHECK (final_amount = GREATEST(subtotal - discount_amount + other_fee_amount, 0)),
  UNIQUE(cycle_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tuition_invoices_student_status
  ON tuition_invoices(student_id, status, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_tuition_invoices_teacher_cycle
  ON tuition_invoices(teacher_id, cycle_id, status);

CREATE TABLE IF NOT EXISTS tuition_invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES tuition_invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(30) NOT NULL,
  description VARCHAR(300) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_invoice_items_type_check
    CHECK (item_type IN ('TUITION','DISCOUNT','OTHER'))
);
CREATE INDEX IF NOT EXISTS idx_tuition_invoice_items_invoice
  ON tuition_invoice_items(invoice_id, id);

CREATE TABLE IF NOT EXISTS tuition_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES tuition_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_no VARCHAR(150),
  note TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tuition_payments_method_check
    CHECK (payment_method IN ('BANK_TRANSFER','CASH','OTHER'))
);
CREATE INDEX IF NOT EXISTS idx_tuition_payments_invoice_paid
  ON tuition_payments(invoice_id, paid_at DESC);

-- Seed the rates confirmed for the current teaching model.
-- Grade 6 represents the "lớp 5 lên 6" group.
INSERT INTO tuition_plans(
  teacher_id,class_id,name,billing_type,unit_price,billed_statuses,effective_from,is_active
)
SELECT c.teacher_id,
       c.id,
       CASE
         WHEN g.grade_no = 6 THEN 'Học phí lớp 5 lên 6'
         ELSE 'Học phí lớp ' || g.grade_no::text
       END,
       'PER_SESSION',
       CASE WHEN g.grade_no = 6 THEN 150000 ELSE 220000 END,
       '["PRESENT","LATE","ONLINE"]'::jsonb,
       CURRENT_DATE,
       TRUE
  FROM classes c
  JOIN grades g ON g.id = c.grade_id
 WHERE c.teacher_id IS NOT NULL
   AND c.deleted_at IS NULL
   AND c.status = 'ACTIVE'
   AND g.grade_no IN (6,7,8,9)
   AND NOT EXISTS (
       SELECT 1 FROM tuition_plans p
        WHERE p.class_id = c.id AND p.is_active = TRUE
   );

COMMIT;


-- v0.24.0 - Username authentication, student codes and deterministic tuition transfer content.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

WITH candidates AS (
  SELECT id,
         CASE
           WHEN LENGTH(COALESCE(NULLIF(LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(email,''),'@',1), '[^a-zA-Z0-9._-]+', '', 'g')), ''), '')) >= 3
             THEN LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(email,''),'@',1), '[^a-zA-Z0-9._-]+', '', 'g'))
           ELSE 'user' || id::text
         END AS base
    FROM users
   WHERE username IS NULL OR BTRIM(username) = ''
), ranked AS (
  SELECT id, base, COUNT(*) OVER (PARTITION BY base) AS duplicate_count
    FROM candidates
)
UPDATE users u
   SET username = CASE
     WHEN r.duplicate_count = 1
      AND NOT EXISTS (
        SELECT 1 FROM users e
         WHERE e.id <> u.id
           AND e.username IS NOT NULL
           AND LOWER(e.username) = r.base
      ) THEN r.base
     ELSE r.base || '_' || u.id::text
   END
  FROM ranked r
 WHERE u.id = r.id;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_ci ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role_username ON users(role, LOWER(username));

ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code VARCHAR(40);

WITH picked_grade AS (
  SELECT s.id,
         (
           SELECT g.grade_no
             FROM class_students cs
             JOIN classes c ON c.id = cs.class_id
             JOIN grades g ON g.id = c.grade_id
            WHERE cs.student_id = s.id
              AND cs.status = 'ACTIVE'
              AND c.deleted_at IS NULL
              AND g.grade_no IN (6,7,8,9)
            ORDER BY c.id
            LIMIT 1
         ) AS grade_no
    FROM students s
)
UPDATE students s
   SET student_code = 'Y' || pg.grade_no::text || '_HS' || s.id::text
  FROM picked_grade pg
 WHERE s.id = pg.id
   AND pg.grade_no IS NOT NULL
   AND (s.student_code IS NULL OR BTRIM(s.student_code) = '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_student_code ON students(student_code) WHERE student_code IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_student_code_format_check'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_student_code_format_check
      CHECK (student_code IS NULL OR student_code ~ '^Y(6|7|8|9)_HS[0-9]+$');
  END IF;
END $$;

ALTER TABLE tuition_invoices ADD COLUMN IF NOT EXISTS transfer_code VARCHAR(100);
UPDATE tuition_invoices i
   SET transfer_code = TO_CHAR(cy.period_month, 'MMYYYY') || s.student_code
  FROM tuition_cycles cy, students s
 WHERE i.cycle_id = cy.id
   AND i.student_id = s.id
   AND s.student_code IS NOT NULL
   AND (i.transfer_code IS NULL OR BTRIM(i.transfer_code) = '');
CREATE INDEX IF NOT EXISTS idx_tuition_invoices_transfer_code ON tuition_invoices(transfer_code);

COMMIT;

-- v0.25.0 - Google Sheets Schema Profiles & Dry-run Validation.
-- No physical schema additions. The profile is stored under:
-- external_data_sources.settings.sheet_profile
-- and materialization is guarded by settings.require_confirmed_sheet_profile.
UPDATE external_data_sources
   SET settings = jsonb_set(
         jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{sheet_profile}',
           CASE
             WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)->'sheet_profile') = 'object'
               THEN COALESCE(settings, '{}'::jsonb)->'sheet_profile'
             ELSE jsonb_build_object(
               'version', 1,
               'mode', 'AUTO',
               'confirmed', FALSE,
               'attendance_aliases', jsonb_build_array(),
               'column_overrides', '{}'::jsonb
             )
           END,
           TRUE
         ),
         '{require_confirmed_sheet_profile}',
         'true'::jsonb,
         TRUE
       )
 WHERE provider = 'GOOGLE_SHEETS';

-- ============================================================================
-- END SOURCE: db/schema.sql
-- ============================================================================


-- ============================================================================
-- BEGIN SOURCE: db/neon_upgrade_v0.25.2.sql
-- ============================================================================

-- English Classroom v0.25.2
-- Tuition transfer content: MMYYYY{student_code}
-- Example: 09/2026 + Y6_HS9 => 092026Y6_HS9
--
-- Safety:
-- - Rewrites DRAFT invoices.
-- - Rewrites UNPAID invoices only when amount_paid=0.
-- - Preserves PARTIAL/PAID/CANCELLED history.

BEGIN;

UPDATE tuition_invoices i
   SET transfer_code = TO_CHAR(cy.period_month, 'MMYYYY') || s.student_code,
       updated_at = NOW()
  FROM tuition_cycles cy,
       students s
 WHERE i.cycle_id = cy.id
   AND i.student_id = s.id
   AND s.student_code IS NOT NULL
   AND BTRIM(s.student_code) <> ''
   AND (
        i.status = 'DRAFT'
        OR (i.status = 'UNPAID' AND COALESCE(i.amount_paid, 0) = 0)
       )
   AND i.transfer_code IS DISTINCT FROM
       TO_CHAR(cy.period_month, 'MMYYYY') || s.student_code;

COMMIT;

-- Verify:
-- SELECT i.id, cy.period_month, s.student_code, i.status, i.transfer_code
-- FROM tuition_invoices i
-- JOIN tuition_cycles cy ON cy.id=i.cycle_id
-- JOIN students s ON s.id=i.student_id
-- ORDER BY i.id DESC;

-- ============================================================================
-- END SOURCE: db/neon_upgrade_v0.25.2.sql
-- ============================================================================


-- ============================================================================
-- BEGIN SOURCE: sql/upgrade_v0.25.4.sql
-- ============================================================================

-- English Classroom v0.25.4
-- Google Sheets Score Deduplication Hotfix
-- PostgreSQL / Neon
--
-- Mục tiêu:
--   1) Sao lưu các student_scores Google Sheets bị trùng.
--   2) Giữ lại đúng 1 bản ghi mới nhất cho cùng logical score.
--   3) Refresh student_progress_summary cho học viên bị ảnh hưởng.
--
-- Logical identity dùng cho cleanup dữ liệu cũ:
--   student_id + class_id + sourceId + ngày + title + category + max_score
-- Không đưa score vào identity để trường hợp Sheet sửa 36/40 -> 38/40 vẫn chỉ còn 1 record.

BEGIN;

-- Backup có thể dùng để phục hồi các dòng bị loại nếu cần.
CREATE TABLE IF NOT EXISTS student_scores_dedup_backup_v0254 AS
SELECT s.*, NOW()::timestamptz AS backed_up_at
FROM student_scores s
WHERE FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_dedup_backup_v0254_id
ON student_scores_dedup_backup_v0254(id);

DROP TABLE IF EXISTS _v0254_duplicate_score_ids;
CREATE TEMP TABLE _v0254_duplicate_score_ids ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        s.id,
        s.student_id,
        ROW_NUMBER() OVER (
            PARTITION BY
                s.student_id,
                s.class_id,
                COALESCE(s.source_payload->>'sourceId', ''),
                s.recorded_at::date,
                BTRIM(s.title),
                COALESCE(s.category, ''),
                s.max_score
            ORDER BY s.id DESC
        ) AS rn
    FROM student_scores s
    WHERE s.source_type = 'GOOGLE_SHEETS'
      AND NULLIF(s.source_payload->>'sourceId', '') IS NOT NULL
)
SELECT id, student_id
FROM ranked
WHERE rn > 1;

-- Preview trong log SQL trước khi xóa.
DO $$
DECLARE
    v_duplicate_count bigint;
    v_student_count bigint;
BEGIN
    SELECT COUNT(*), COUNT(DISTINCT student_id)
    INTO v_duplicate_count, v_student_count
    FROM _v0254_duplicate_score_ids;

    RAISE NOTICE 'v0.25.4: duplicate score rows = %, affected students = %',
        v_duplicate_count, v_student_count;
END $$;

INSERT INTO student_scores_dedup_backup_v0254
SELECT s.*, NOW()::timestamptz
FROM student_scores s
JOIN _v0254_duplicate_score_ids d ON d.id = s.id
ON CONFLICT (id) DO NOTHING;

DELETE FROM student_scores s
USING _v0254_duplicate_score_ids d
WHERE s.id = d.id;

-- Recompute progress exactly theo logic hiện tại của repository cho học viên bị ảnh hưởng.
WITH target AS (
    SELECT DISTINCT student_id
    FROM _v0254_duplicate_score_ids
), score_summary AS (
    SELECT
        t.student_id,
        COALESCE(
            ROUND(AVG((ss.score / NULLIF(ss.max_score, 0)) * 10)::numeric, 2),
            0
        ) AS average_score
    FROM target t
    LEFT JOIN student_scores ss ON ss.student_id = t.student_id
    GROUP BY t.student_id
), session_rows AS (
    SELECT a.student_id, cs.session_date AS attendance_date, a.status
    FROM session_attendance a
    JOIN class_sessions cs ON cs.id = a.session_id
    WHERE a.student_id IN (SELECT student_id FROM target)
), combined_attendance AS (
    SELECT student_id, attendance_date, status
    FROM session_rows
    UNION ALL
    SELECT ar.student_id, ar.attendance_date, ar.status
    FROM attendance_records ar
    WHERE ar.student_id IN (SELECT student_id FROM target)
      AND NOT EXISTS (
          SELECT 1
          FROM session_rows sr
          WHERE sr.student_id = ar.student_id
            AND sr.attendance_date = ar.attendance_date
      )
), attendance_summary AS (
    SELECT
        t.student_id,
        CASE
            WHEN COUNT(c.student_id) = 0 THEN 0
            ELSE ROUND(
                100.0 * COUNT(c.student_id) FILTER (
                    WHERE c.status IN ('PRESENT', 'LATE', 'ONLINE')
                ) / COUNT(c.student_id),
                2
            )
        END AS attendance_rate
    FROM target t
    LEFT JOIN combined_attendance c ON c.student_id = t.student_id
    GROUP BY t.student_id
)
INSERT INTO student_progress_summary(student_id, average_score, attendance_rate, updated_at)
SELECT t.student_id, ss.average_score, att.attendance_rate, NOW()
FROM target t
JOIN score_summary ss ON ss.student_id = t.student_id
JOIN attendance_summary att ON att.student_id = t.student_id
ON CONFLICT(student_id)
DO UPDATE SET
    average_score = EXCLUDED.average_score,
    attendance_rate = EXCLUDED.attendance_rate,
    updated_at = NOW();

COMMIT;

-- Kiểm tra sau migration: query này phải trả về 0 dòng.
SELECT
    student_id,
    class_id,
    source_payload->>'sourceId' AS source_id,
    recorded_at::date AS score_date,
    title,
    category,
    max_score,
    COUNT(*) AS duplicate_count
FROM student_scores
WHERE source_type = 'GOOGLE_SHEETS'
  AND NULLIF(source_payload->>'sourceId', '') IS NOT NULL
GROUP BY
    student_id,
    class_id,
    source_payload->>'sourceId',
    recorded_at::date,
    title,
    category,
    max_score
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, student_id, score_date;

-- ============================================================================
-- END SOURCE: sql/upgrade_v0.25.4.sql
-- ============================================================================


-- ============================================================================
-- BEGIN SOURCE: sql/upgrade_v0.25.5.sql
-- ============================================================================

-- English Classroom v0.25.5
-- Google Sheets automatic sync interval: every 3 days
-- PostgreSQL / Neon
--
-- 3 days = 4320 minutes.
-- Manual sync is unaffected.
-- The scheduler can continue checking for due sources frequently; only sources
-- whose last sync is >= 4320 minutes old will be scheduled automatically.

BEGIN;

-- 1) Remove the old CHECK constraint(s) that cap sync_interval_minutes at 1440.
-- The original v0.20.0 schema created the CHECK inline, so PostgreSQL usually
-- named it external_data_sources_sync_interval_minutes_check. This dynamic block
-- is resilient if the actual constraint name differs.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'c'
          AND n.nspname = current_schema()
          AND t.relname = 'external_data_sources'
          AND pg_get_constraintdef(c.oid) ILIKE '%sync_interval_minutes%'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I',
            current_schema(),
            'external_data_sources',
            r.conname
        );
    END LOOP;
END $$;

-- 2) Default for newly created data sources.
ALTER TABLE external_data_sources
    ALTER COLUMN sync_interval_minutes SET DEFAULT 4320;

-- 3) Convert all current Google Sheets sources to 3 days/lần.
UPDATE external_data_sources
SET sync_interval_minutes = 4320,
    updated_at = NOW()
WHERE provider = 'GOOGLE_SHEETS'
  AND sync_interval_minutes IS DISTINCT FROM 4320;

-- 4) Allow values up to 7 days at schema level. Google Sheets itself is fixed
-- to 4320 below; the wider range keeps the column reusable and avoids a hard
-- one-day ceiling inherited from v0.20.0.
ALTER TABLE external_data_sources
    ADD CONSTRAINT external_data_sources_sync_interval_minutes_check
    CHECK (sync_interval_minutes BETWEEN 5 AND 10080);

-- 5) DB-side safety: even if an older application build still sends 15 minutes,
-- Google Sheets sources are normalized to 4320 minutes on INSERT/UPDATE.
CREATE OR REPLACE FUNCTION enforce_google_sheet_sync_interval_v0255()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.provider = 'GOOGLE_SHEETS' THEN
        NEW.sync_interval_minutes := 4320;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_sheet_sync_interval_v0255
ON external_data_sources;

CREATE TRIGGER trg_google_sheet_sync_interval_v0255
BEFORE INSERT OR UPDATE OF provider, sync_interval_minutes
ON external_data_sources
FOR EACH ROW
EXECUTE FUNCTION enforce_google_sheet_sync_interval_v0255();

COMMIT;

-- Verification: all Google Sheets sources should report 4320.
SELECT
    id,
    teacher_id,
    class_id,
    provider,
    name,
    sync_interval_minutes,
    last_synced_at,
    last_success_at
FROM external_data_sources
WHERE provider = 'GOOGLE_SHEETS'
ORDER BY id;

-- ============================================================================
-- END SOURCE: sql/upgrade_v0.25.5.sql
-- ============================================================================
