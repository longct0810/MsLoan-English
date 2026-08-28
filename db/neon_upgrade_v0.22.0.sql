-- v0.22.0 - Student Learning Profile & Skill Analytics
BEGIN;
CREATE INDEX IF NOT EXISTS idx_student_skill_events_student_class_skill_date
  ON student_skill_events(student_id,class_id,skill_code,recorded_at DESC,id DESC);
COMMIT;
