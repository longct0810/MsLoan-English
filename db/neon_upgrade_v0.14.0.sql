-- English Classroom v0.14.0
-- Security / ownership hardening and score precision upgrade.
BEGIN;

-- 100/100 and exams with totals above 99.99 must be representable.
ALTER TABLE assignment_submissions
  ALTER COLUMN score TYPE NUMERIC(8,2) USING score::NUMERIC(8,2);

ALTER TABLE student_scores
  ALTER COLUMN score TYPE NUMERIC(8,2) USING score::NUMERIC(8,2),
  ALTER COLUMN max_score TYPE NUMERIC(8,2) USING max_score::NUMERIC(8,2);

-- Ownership lookups used throughout teacher-scoped portals.
CREATE INDEX IF NOT EXISTS idx_classes_teacher_active
  ON classes(teacher_id, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_class_students_active_student_class
  ON class_students(student_id, class_id)
  WHERE status='ACTIVE';

CREATE INDEX IF NOT EXISTS idx_questions_created_by
  ON questions(created_by, id);

COMMIT;
