# Chẩn đoán lưu học viên — v0.20.2

## Nguyên nhân đã xác định
`src/modules/students/student.repository.js` có hai nhánh lưu dữ liệu:

- `DEMO_MODE=true`: ghi vào `demoStore` trong RAM, không INSERT PostgreSQL.
- `DEMO_MODE=false`: dùng transaction PostgreSQL và INSERT `users`, `students`, `student_accounts`, `parent_students`, `student_progress_summary`, `class_students`.

Google Sheets Data Source đọc PostgreSQL trực tiếp. Vì vậy học viên tạo ở DEMO_MODE có thể xuất hiện trên màn hình Học viên nhưng không xuất hiện ở Nguồn dữ liệu.

## Cấu hình production bắt buộc
```env
NODE_ENV=production
DEMO_MODE=false
SHOW_DEMO_ACCOUNTS_ON_LOGIN=false
```

Sau khi sửa `.env`:
```bash
pm2 restart all --update-env
```

Kiểm tra:
```bash
curl http://127.0.0.1:<PORT>/health
```
Kết quả phải có:
```json
{
  "storageMode": "postgresql",
  "demoMode": false
}
```

## SQL kiểm tra một học viên
Ví dụ với `Cao Gia Linh`:

```sql
SELECT s.id, s.full_name, s.email, s.status, s.created_at,
       sa.user_id AS student_user_id,
       u.status AS user_status
FROM students s
LEFT JOIN student_accounts sa ON sa.student_id = s.id
LEFT JOIN users u ON u.id = sa.user_id
WHERE s.full_name ILIKE '%Cao Gia Linh%'
  AND s.deleted_at IS NULL;

SELECT c.id AS class_id, c.name AS class_name, cs.status, cs.joined_at, cs.left_at
FROM students s
JOIN class_students cs ON cs.student_id = s.id
JOIN classes c ON c.id = cs.class_id
WHERE s.full_name ILIKE '%Cao Gia Linh%';

SELECT pu.id AS parent_user_id, pu.full_name, pu.email, pu.status, ps.relationship
FROM students s
JOIN parent_students ps ON ps.student_id = s.id
JOIN users pu ON pu.id = ps.parent_user_id
WHERE s.full_name ILIKE '%Cao Gia Linh%';
```

Nếu không có record sau khi trước đó UI báo thành công, học viên đã được tạo trong RAM khi DEMO_MODE=true. Cần tạo lại sau khi chuyển sang PostgreSQL mode.
