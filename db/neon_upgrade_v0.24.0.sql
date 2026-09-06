-- English Classroom v0.24.0
-- Username Authentication + Student Code + Tuition Transfer Code
-- Baseline: v0.23.1

BEGIN;

-- 1) Authentication: username becomes the login identifier.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Backfill username from the legacy email local-part.
-- If local-parts collide, append the user id to keep the value deterministic and unique.
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

-- 2) Stable student code: Y{6|7|8|9}_HS{student_id}.
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

-- 3) Tuition transfer content: HP YYYYMM {student_code}.
ALTER TABLE tuition_invoices ADD COLUMN IF NOT EXISTS transfer_code VARCHAR(100);
UPDATE tuition_invoices i
   SET transfer_code = 'HP ' || TO_CHAR(cy.period_month, 'YYYYMM') || ' ' || s.student_code
  FROM tuition_cycles cy, students s
 WHERE i.cycle_id = cy.id
   AND i.student_id = s.id
   AND s.student_code IS NOT NULL
   AND (i.transfer_code IS NULL OR BTRIM(i.transfer_code) = '');
CREATE INDEX IF NOT EXISTS idx_tuition_invoices_transfer_code ON tuition_invoices(transfer_code);

COMMIT;

-- Verification helpers:
-- SELECT id, full_name, username, role, email FROM users ORDER BY id;
-- SELECT id, full_name, student_code FROM students ORDER BY id;
-- SELECT id, public_code, transfer_code FROM tuition_invoices ORDER BY id DESC LIMIT 20;
