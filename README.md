# English Classroom MVP v0.4.0

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL/Neon.

## Thay đổi v0.4.0

### Bài học & tài liệu

- Giáo viên xem danh sách bài học theo lớp/trạng thái.
- Tạo bài học theo `Class → Unit → Lesson`.
- Nội dung gồm: tên bài, Unit, mô tả ngắn, nội dung chi tiết, thứ tự.
- Bài học có trạng thái `DRAFT / PUBLISHED / ARCHIVED`.
- Chỉnh sửa bài học.
- Xuất bản bài học.
- Thêm tài liệu vào bài học: PDF, Audio, Video, Link, Flashcard, Image.
- Tài liệu hỗ trợ mô tả và `resource_url`.
- Từ bài học có thể tạo bài tập liên quan.

### Bài tập & chấm bài

- Giáo viên tạo bài tập theo lớp và tùy chọn gắn với một bài học.
- Loại: `HOMEWORK / PRACTICE / QUIZ`.
- Có mô tả, yêu cầu làm bài, hạn nộp và điểm tối đa.
- Bài tập tạo ở trạng thái nháp trước khi giao cho lớp.
- Chỉnh sửa bài tập, hạn nộp, yêu cầu và điểm tối đa.
- Theo dõi số học sinh đã nộp / tổng số / đã chấm.
- Xem bài làm của từng học sinh.
- Chấm điểm và nhập phản hồi.
- Khi chấm, điểm được đồng bộ sang `student_scores` và tính lại `student_progress_summary.average_score`.

### Student Portal

- Nút “Làm bài/Xem bài” hoạt động thật.
- Học sinh xem chi tiết đề bài.
- Nhập nội dung và nộp bài.
- Hệ thống tự đánh dấu `SUBMITTED` hoặc `LATE` theo hạn nộp.
- Sau khi giáo viên chấm, học sinh xem điểm và phản hồi.
- Bài đã chấm được khóa nộp lại trong MVP.
- Tài liệu học tập có thể mở `resource_url` nếu giáo viên đã cấu hình.

### Version trên giao diện

Version lấy từ `package.json` và hiển thị tại:

- Navbar.
- Sidebar.
- Footer.
- Trang đăng nhập.

Có thể override bằng `APP_VERSION` trong `.env`; để trống sẽ tự lấy `package.json.version`.

## Luồng chức năng hiện tại

```text
Teacher
  │
  ├── Class
  │    ├── Class Session → Attendance → Student Note
  │    ├── Lesson → Material
  │    └── Assignment → Submission → Grade / Feedback
  │
  ├───────────────────────────────────────┐
  ▼                                       ▼
Student Portal                        Parent Portal
  │                                       │
  ├── Materials                           ├── Progress
  ├── Assignments                         ├── Attendance
  ├── Submit answer                       ├── Assignment status
  ├── Grade / feedback                    └── Teacher notes
  └── Progress
```

## Công nghệ

- Node.js 20+
- Express 5
- EJS
- Bootstrap 5
- PostgreSQL
- Neon PostgreSQL qua `DATABASE_URL`
- `express-session` + `connect-pg-simple`

## Cập nhật từ v0.3.0 lên v0.4.0

Không cần xóa database Neon hiện tại.

Sau khi cập nhật source:

```bash
npm install
npm run db:migrate
npm start
```

`db/schema.sql` sử dụng `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` và index idempotent.

Ngoài ra có 2 file cho Neon SQL Editor:

```text
db/neon_upgrade_v0.4.0.sql      # DB đã có dữ liệu v0.3.x
db/neon_init_v0.4.0_demo.sql    # DB mới: schema + toàn bộ demo data
```

Không dùng file `init` trên database production đã có dữ liệu thật; với DB hiện tại nên ưu tiên `upgrade` hoặc `npm run db:migrate`.

## Render.com

Environment tối thiểu:

```env
NODE_ENV=production
DEMO_MODE=false
DATABASE_URL=<Neon pooled connection string>
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
TRUST_PROXY=1
SESSION_SECURE=true
```

Không commit `.env` lên GitHub.

Build / Start:

```text
Build Command: npm install && npm run db:migrate
Start Command: npm start
```

Sau khi push GitHub, nếu Render bật Auto Deploy thì source mới được deploy tự động và migration sẽ bổ sung schema v0.4.0.

## Routes mới v0.4.0

### Teacher - Lessons

```text
GET  /lessons
GET  /lessons/new
POST /lessons
GET  /lessons/:id
GET  /lessons/:id/edit
POST /lessons/:id/update
POST /lessons/:id/publish
POST /lessons/:id/materials

GET  /api/v1/lessons
```

### Teacher - Assignments

```text
GET  /assignments
GET  /assignments/new
POST /assignments
GET  /assignments/:id
GET  /assignments/:id/edit
POST /assignments/:id/update
POST /assignments/:id/publish
POST /assignments/:id/submissions/:studentId/grade

GET  /api/v1/assignments
```

### Student

```text
GET  /student/assignments/:id
POST /student/assignments/:id/submit
```

## Database v0.4.0

Bảng mới:

```text
lessons
```

Mở rộng:

```text
materials
  + lesson_id
  + description
  + resource_url
  + status
  + created_by

assignments
  + lesson_id
  + instructions
  + max_score
  + published_at

assignment_submissions
  + submission_text
  + teacher_feedback
  + updated_at

student_scores
  + assignment_id
```

## Cài local

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Mở:

```text
http://localhost:3000
```

## PostgreSQL local

Nếu không dùng Neon:

```env
DATABASE_URL=
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=english_classroom
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
```

## Cấu trúc module

```text
src/modules/
├── auth/
├── dashboard/
├── classes/
├── students/
├── sessions/
├── lessons/          # v0.4.0
├── assignments/      # v0.4.0
├── portal/
└── health/
```

## Các module dự kiến tiếp theo

Phiên bản sau nên tập trung vào:

1. Question Bank.
2. Câu hỏi Multiple Choice / True-False / Fill Blank.
3. Exam Builder.
4. Student Exam UI + countdown/autosave.
5. Auto grading.
6. Báo cáo lớp/học viên.
7. Notification.
8. File Storage thực tế (S3/R2/MinIO) thay cho URL thủ công.
9. CSRF protection, audit log và quản lý nhiều giáo viên.
