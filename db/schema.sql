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
