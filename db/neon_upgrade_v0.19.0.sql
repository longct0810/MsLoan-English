-- English Classroom v0.19.0 - Exam 2.0
-- Prerequisite: database already upgraded through v0.18.0.
BEGIN;

ALTER TABLE exams ADD COLUMN IF NOT EXISTS selection_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS randomize_questions BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS randomize_options BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_score_percent NUMERIC(5,2) NOT NULL DEFAULT 50;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_selection_mode_check;
ALTER TABLE exams ADD CONSTRAINT exams_selection_mode_check CHECK(selection_mode IN ('MANUAL','POOL'));
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_pass_score_percent_check;
ALTER TABLE exams ADD CONSTRAINT exams_pass_score_percent_check CHECK(pass_score_percent BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS exam_pool_rules (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE RESTRICT,
  difficulty VARCHAR(20),
  question_type VARCHAR(30),
  question_count INTEGER NOT NULL CHECK(question_count BETWEEN 1 AND 200),
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE exam_pool_rules DROP CONSTRAINT IF EXISTS exam_pool_rules_difficulty_check;
ALTER TABLE exam_pool_rules ADD CONSTRAINT exam_pool_rules_difficulty_check
  CHECK(difficulty IS NULL OR difficulty IN ('EASY','MEDIUM','HARD'));
ALTER TABLE exam_pool_rules DROP CONSTRAINT IF EXISTS exam_pool_rules_question_type_check;
ALTER TABLE exam_pool_rules ADD CONSTRAINT exam_pool_rules_question_type_check
  CHECK(question_type IS NULL OR question_type IN ('MULTIPLE_CHOICE','TRUE_FALSE','FILL_BLANK','ESSAY'));
CREATE INDEX IF NOT EXISTS idx_exam_pool_rules_exam ON exam_pool_rules(exam_id,sort_order,id);

CREATE TABLE IF NOT EXISTS exam_question_snapshots (
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL,
  question_type VARCHAR(30) NOT NULL,
  stem TEXT NOT NULL,
  correct_answer TEXT,
  explanation TEXT,
  difficulty VARCHAR(20),
  points NUMERIC(8,2) NOT NULL CHECK(points >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(exam_id,question_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_question_snapshots_order
  ON exam_question_snapshots(exam_id,sort_order,question_id);

CREATE TABLE IF NOT EXISTS exam_attempt_questions (
  attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  option_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY(attempt_id,question_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_attempt_questions_order
  ON exam_attempt_questions(attempt_id,sort_order,question_id);

CREATE TABLE IF NOT EXISTS exam_student_overrides (
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  extra_minutes INTEGER NOT NULL DEFAULT 0 CHECK(extra_minutes BETWEEN 0 AND 1440),
  max_attempts_override INTEGER CHECK(max_attempts_override BETWEEN 1 AND 20),
  reopen_until TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(exam_id,student_id)
);
CREATE INDEX IF NOT EXISTS idx_exam_student_overrides_student
  ON exam_student_overrides(student_id,exam_id) WHERE is_enabled=TRUE;

ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS effective_duration_minutes INTEGER;
ALTER TABLE exam_answers ADD COLUMN IF NOT EXISTS selected_option_key VARCHAR(20);

UPDATE exam_answers a
   SET selected_option_key=qo.option_key
  FROM question_options qo
 WHERE a.selected_option_key IS NULL AND a.selected_option_id=qo.id;

-- Backfill snapshots for already-published/closed exams. This freezes current question text/options
-- from the moment v0.19.0 is applied; future publishes refresh snapshots explicitly in application code.
INSERT INTO exam_question_snapshots(
  exam_id,question_id,question_type,stem,correct_answer,explanation,difficulty,points,sort_order,options,skill_codes
)
SELECT eq.exam_id,q.id,q.question_type,q.stem,q.correct_answer,q.explanation,q.difficulty,eq.points,eq.sort_order,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'id',qo.id,'optionKey',qo.option_key,'optionText',qo.option_text,
         'isCorrect',qo.is_correct,'sortOrder',qo.sort_order
       ) ORDER BY qo.sort_order,qo.id) FROM question_options qo WHERE qo.question_id=q.id),'[]'::jsonb),
       COALESCE((SELECT jsonb_agg(qs.skill_code ORDER BY qs.skill_code) FROM question_skills qs WHERE qs.question_id=q.id),'[]'::jsonb)
  FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
  JOIN exams e ON e.id=eq.exam_id
 WHERE e.status IN ('PUBLISHED','CLOSED')
ON CONFLICT(exam_id,question_id) DO NOTHING;

COMMIT;
