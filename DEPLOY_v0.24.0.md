# Deploy English Classroom v0.24.0

Baseline: v0.23.1.

## 1. Backup

Backup database/Neon branch và source đang chạy trước khi nâng cấp.

## 2. Chạy migration trước khi deploy code

Chạy:

```text
db/neon_upgrade_v0.24.0.sql
```

Source v0.24.0 yêu cầu cột `users.username`, vì vậy không restart source mới trước khi migration thành công.

## 3. Kiểm tra tài khoản sau migration

```sql
SELECT id, full_name, role, username, email
FROM users
ORDER BY role, id;
```

Username cũ được tạo từ phần trước `@` của email. Nếu trùng, migration thêm `_<id>`.

Ví dụ:

```text
teacher@example.com -> teacher
teacher@other.com   -> teacher_12   -- nếu trùng
```

## 4. Kiểm tra mã học sinh

```sql
SELECT id, full_name, student_code
FROM students
ORDER BY id;
```

Học viên đang thuộc lớp ACTIVE grade 6/7/8/9 sẽ có mã dạng `Y6_HS9`.

## 5. Deploy

Giữ nguyên `.env` production. Nếu có `APP_VERSION`, đổi thành `0.24.0` hoặc bỏ biến này để app lấy version từ `package.json`.

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

## 6. Test đăng nhập

Từ v0.24.0, form login chỉ nhận username. Email không còn được dùng làm login identifier.

## 7. Test tạo học viên

Tạo học viên mới và xác nhận:
- frontend không yêu cầu email;
- student/parent username được tạo;
- `students.student_code` sinh đúng theo grade;
- có thể đăng nhập bằng username/password.

## 8. Test học phí / VietQR

Tạo lại hoặc mở invoice. Kiểm tra:

```sql
SELECT i.id, s.student_code, i.transfer_code
FROM tuition_invoices i
JOIN students s ON s.id=i.student_id
ORDER BY i.id DESC
LIMIT 20;
```

Nội dung mong đợi: `HP YYYYMM Yx_HSid`.
