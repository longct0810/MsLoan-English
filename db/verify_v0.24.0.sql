-- Verify English Classroom v0.24.0

-- 1. Username accounts
SELECT id, full_name, role, username, email, status
FROM users
ORDER BY role, id;

-- 2. Student codes + active grades
SELECT s.id,
       s.full_name,
       s.student_code,
       STRING_AGG(DISTINCT g.grade_no::text, ', ' ORDER BY g.grade_no::text) AS active_grades
FROM students s
LEFT JOIN class_students cs ON cs.student_id=s.id AND cs.status='ACTIVE'
LEFT JOIN classes c ON c.id=cs.class_id AND c.deleted_at IS NULL
LEFT JOIN grades g ON g.id=c.grade_id
GROUP BY s.id, s.full_name, s.student_code
ORDER BY s.id;

-- 3. Tuition transfer codes
SELECT i.id,
       cy.period_month,
       s.id AS student_id,
       s.full_name,
       s.student_code,
       i.public_code,
       i.transfer_code,
       i.status
FROM tuition_invoices i
JOIN tuition_cycles cy ON cy.id=i.cycle_id
JOIN students s ON s.id=i.student_id
ORDER BY i.id DESC
LIMIT 100;

-- 4. Missing required identifiers for active domain objects
SELECT 'USER_WITHOUT_USERNAME' AS issue, id::text AS ref, full_name AS detail
FROM users
WHERE username IS NULL OR BTRIM(username)=''
UNION ALL
SELECT 'ACTIVE_STUDENT_WITHOUT_CODE', s.id::text, s.full_name
FROM students s
WHERE s.status='ACTIVE'
  AND (s.student_code IS NULL OR BTRIM(s.student_code)='')
  AND EXISTS (
    SELECT 1
    FROM class_students cs
    JOIN classes c ON c.id=cs.class_id
    JOIN grades g ON g.id=c.grade_id
    WHERE cs.student_id=s.id
      AND cs.status='ACTIVE'
      AND c.deleted_at IS NULL
      AND g.grade_no IN (6,7,8,9)
  );
