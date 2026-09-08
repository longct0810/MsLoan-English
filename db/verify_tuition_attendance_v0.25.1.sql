-- Diagnose tuition candidate mismatch for a class/month.
-- Adjust class name / date range if needed.
WITH target_class AS (
  SELECT id, name
  FROM classes
  WHERE name = 'English 6 - T5/T7'
    AND deleted_at IS NULL
  LIMIT 1
), attendance_students AS (
  SELECT DISTINCT a.student_id
  FROM class_sessions cs
  JOIN session_attendance a ON a.session_id = cs.id
  WHERE cs.class_id = (SELECT id FROM target_class)
    AND cs.session_date BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
    AND cs.status <> 'CANCELLED'
), membership_students AS (
  SELECT cs.student_id, cs.joined_at, cs.left_at, cs.status
  FROM class_students cs
  WHERE cs.class_id = (SELECT id FROM target_class)
    AND cs.joined_at <= DATE '2026-08-31'
    AND (cs.left_at IS NULL OR cs.left_at >= DATE '2026-08-01')
)
SELECT
  s.id AS student_id,
  s.student_code,
  s.full_name,
  CASE WHEN a.student_id IS NOT NULL THEN 'YES' ELSE 'NO' END AS has_attendance_in_august,
  CASE WHEN m.student_id IS NOT NULL THEN 'YES' ELSE 'NO' END AS old_logic_membership_eligible,
  m.joined_at,
  m.left_at,
  m.status AS membership_status,
  (
    SELECT COUNT(*)
    FROM class_sessions cs2
    JOIN session_attendance a2 ON a2.session_id=cs2.id
    WHERE cs2.class_id=(SELECT id FROM target_class)
      AND cs2.session_date BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
      AND a2.student_id=s.id
  ) AS attendance_rows
FROM students s
LEFT JOIN attendance_students a ON a.student_id=s.id
LEFT JOIN membership_students m ON m.student_id=s.id
WHERE a.student_id IS NOT NULL OR m.student_id IS NOT NULL
ORDER BY s.full_name;

-- Summary: old v0.25.0 candidate count vs v0.25.1 attendance-based count.
WITH target_class AS (
  SELECT id FROM classes WHERE name='English 6 - T5/T7' AND deleted_at IS NULL LIMIT 1
)
SELECT
  (
    SELECT COUNT(DISTINCT cs.student_id)
    FROM class_students cs
    JOIN students s ON s.id=cs.student_id
    WHERE cs.class_id=(SELECT id FROM target_class)
      AND cs.joined_at <= DATE '2026-08-31'
      AND (cs.left_at IS NULL OR cs.left_at >= DATE '2026-08-01')
      AND s.deleted_at IS NULL
      AND s.status='ACTIVE'
  ) AS old_membership_candidate_count,
  (
    SELECT COUNT(DISTINCT a.student_id)
    FROM class_sessions sess
    JOIN session_attendance a ON a.session_id=sess.id
    WHERE sess.class_id=(SELECT id FROM target_class)
      AND sess.session_date BETWEEN DATE '2026-08-01' AND DATE '2026-08-31'
      AND sess.status<>'CANCELLED'
  ) AS attendance_candidate_count;
