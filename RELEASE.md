# English Classroom v0.19.0

Nâng cấp tuần tự từ **v0.18.0**.

## Database

Trước khi deploy source, chạy trên Neon SQL Editor:

```text
db/neon_upgrade_v0.19.0.sql
```

Không chạy `npm run db:migrate` trên database production hiện có, vì script này vẫn thực thi toàn bộ `db/schema.sql`.

## Deploy

1. Tạo backup/branch Neon.
2. Chạy `db/neon_upgrade_v0.19.0.sql`.
3. Deploy source v0.19.0.
4. Render Build Command: `npm ci`.
5. Render Start Command: `npm start`.
6. Kiểm tra `DEMO_MODE=false` và kết nối PostgreSQL/Neon.

## Nội dung chính
- Exam 2.0: Question Pool, lọc theo skill/difficulty/type.
- Random câu hỏi và đáp án.
- Pass score, student override, reopen/extra time/max attempts.
- Immutable exam snapshots để đề đã publish không đổi khi Question Bank bị chỉnh sửa.
