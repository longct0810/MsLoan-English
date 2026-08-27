-- English Classroom v0.15.0
-- Teacher Report Center: add class scope to student_scores and reporting indexes.
-- Safe to run once or re-run because DDL uses IF NOT EXISTS where applicable.

BEGIN;

ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS class_id BIGINT REFERENCES classes(id) ON DELETE SET NULL;

-- Scores generated from assignments have an unambiguous class.
UPDATE student_scores ss
   SET class_id = a.class_id
  FROM assignments a
 WHERE ss.assignment_id = a.id
   AND ss.class_id IS NULL;

-- Scores generated from exams also have an unambiguous class.
UPDATE student_scores ss
   SET class_id = e.class_id
  FROM exams e
 WHERE ss.exam_id = e.id
   AND ss.class_id IS NULL;

-- Legacy/manual scores without assignment/exam relation are only backfilled when
-- the student currently belongs to exactly one active class. Ambiguous rows remain NULL.
WITH single_class AS (
  SELECT cs.student_id, MIN(cs.class_id) AS class_id
    FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
   WHERE cs.status = 'ACTIVE'
     AND c.deleted_at IS NULL
     AND c.status = 'ACTIVE'
   GROUP BY cs.student_id
  HAVING COUNT(DISTINCT cs.class_id) = 1
)
UPDATE student_scores ss
   SET class_id = sc.class_id
  FROM single_class sc
 WHERE ss.student_id = sc.student_id
   AND ss.class_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_scores_class_recorded
  ON student_scores(class_id, recorded_at DESC, student_id)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_submitted
  ON exam_attempts(student_id, submitted_at DESC)
  WHERE submitted_at IS NOT NULL;

COMMIT;
