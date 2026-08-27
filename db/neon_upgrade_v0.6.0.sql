-- English Classroom v0.6.0
-- Upgrade from v0.5.0: ESSAY questions + manual grading metadata.
-- Safe migration: no DROP TABLE / DELETE data.

BEGIN;

-- Extend question types with ESSAY.
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;
ALTER TABLE questions
  ADD CONSTRAINT questions_question_type_check
  CHECK (question_type IN ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'ESSAY'));

-- Allow attempts that are waiting for teacher grading.
ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_status_check;
ALTER TABLE exam_attempts
  ADD CONSTRAINT exam_attempts_status_check
  CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'PENDING_GRADING', 'GRADED'));

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS auto_score NUMERIC(8,2);

-- Each answer now knows whether it was auto graded or must be manually graded.
ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS grading_status VARCHAR(30) NOT NULL DEFAULT 'NOT_GRADED';
ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS graded_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exam_answers
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;

ALTER TABLE exam_answers DROP CONSTRAINT IF EXISTS exam_answers_grading_status_check;
ALTER TABLE exam_answers
  ADD CONSTRAINT exam_answers_grading_status_check
  CHECK (grading_status IN ('NOT_GRADED', 'AUTO_GRADED', 'PENDING_MANUAL', 'MANUALLY_GRADED'));

CREATE INDEX IF NOT EXISTS idx_exam_attempts_pending_grading
  ON exam_attempts(exam_id, status)
  WHERE status = 'PENDING_GRADING';

CREATE INDEX IF NOT EXISTS idx_exam_answers_grading_status
  ON exam_answers(attempt_id, grading_status);

COMMIT;
