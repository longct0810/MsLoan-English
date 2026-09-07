-- English Classroom v0.24.1
-- Rà soát tài khoản phụ huynh liên kết nhiều học viên.

-- 1. Các PARENT account đang có từ 2 học viên ACTIVE trở lên.
SELECT
  u.id AS parent_user_id,
  u.username,
  u.full_name,
  u.phone,
  COUNT(DISTINCT ps.student_id) AS student_count,
  STRING_AGG(s.student_code || ' - ' || s.full_name, ', ' ORDER BY s.full_name) AS students
FROM users u
JOIN parent_students ps ON ps.parent_user_id=u.id
JOIN students s ON s.id=ps.student_id
WHERE u.role='PARENT'
  AND s.deleted_at IS NULL
  AND s.status='ACTIVE'
GROUP BY u.id,u.username,u.full_name,u.phone
HAVING COUNT(DISTINCT ps.student_id) > 1
ORDER BY student_count DESC,u.username;

-- 2. Kiểm tra riêng ví dụ phụ huynh 0968376596.
SELECT
  u.id AS parent_user_id,
  u.username,
  u.full_name AS parent_name,
  u.phone,
  s.id AS student_id,
  s.student_code,
  s.full_name AS student_name,
  ps.relationship
FROM users u
JOIN parent_students ps ON ps.parent_user_id=u.id
JOIN students s ON s.id=ps.student_id
WHERE LOWER(u.username)=LOWER('0968376596')
ORDER BY s.id;

-- 3. Kiểm tra có học viên nào bị link nhiều PARENT account hay không.
SELECT
  s.id AS student_id,
  s.student_code,
  s.full_name,
  COUNT(DISTINCT ps.parent_user_id) AS parent_account_count,
  STRING_AGG(u.username, ', ' ORDER BY u.username) AS parent_usernames
FROM students s
JOIN parent_students ps ON ps.student_id=s.id
JOIN users u ON u.id=ps.parent_user_id
WHERE s.deleted_at IS NULL
GROUP BY s.id,s.student_code,s.full_name
HAVING COUNT(DISTINCT ps.parent_user_id) > 1
ORDER BY s.id;

-- 4. Kiểm tra username PARENT trùng không phân biệt hoa thường (kỳ vọng 0 dòng).
SELECT LOWER(username) AS normalized_username, COUNT(*) AS duplicate_count
FROM users
WHERE role='PARENT'
GROUP BY LOWER(username)
HAVING COUNT(*) > 1;

-- 5. OPTIONAL REPAIR: đồng bộ cột legacy trên students theo PARENT account canonical.
-- Đây là thao tác an toàn nếu mỗi student chỉ đang link 1 parent account.
UPDATE students s
SET parent_name=u.full_name,
    parent_phone=COALESCE(u.phone,s.parent_phone),
    updated_at=NOW()
FROM parent_students ps
JOIN users u ON u.id=ps.parent_user_id AND u.role='PARENT'
WHERE ps.student_id=s.id
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM parent_students ps2
    WHERE ps2.student_id=s.id
      AND ps2.parent_user_id<>ps.parent_user_id
  );
