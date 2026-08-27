-- English Classroom v0.7.0
-- Upgrade from v0.6.x: student/class CRUD, parent account linkage and safe soft deletes.
-- Safe migration: no DROP TABLE and no DELETE existing business data.
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

SELECT
  (SELECT COUNT(*) FROM students WHERE deleted_at IS NULL) AS active_students,
  (SELECT COUNT(*) FROM classes WHERE deleted_at IS NULL) AS active_classes,
  (SELECT COUNT(*) FROM users WHERE role='PARENT') AS parent_accounts,
  (SELECT COUNT(*) FROM student_accounts) AS student_accounts,
  (SELECT COUNT(*) FROM parent_students) AS parent_links;
