# English Classroom MVP v0.3.0

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL/Neon.

## Thay đổi v0.3.0

Bổ sung luồng nghiệp vụ giáo viên:

- **Buổi học**: tạo buổi học theo lớp, ngày/giờ, chủ đề, kế hoạch và bài tập về nhà.
- **Điểm danh**: Có mặt / Đi muộn / Vắng / Vắng có phép / Học online.
- Ghi chú riêng cho từng trạng thái điểm danh.
- Nút điểm danh nhanh “Tất cả có mặt” hoặc “Tất cả online”.
- Theo dõi số học viên đã điểm danh, có mặt, đi muộn và vắng.
- **Nhận xét học viên theo buổi** với nhóm: Chung, Tiến bộ, Thái độ, Bài tập, Speaking, Listening.
- Nhận xét có tùy chọn cho phép phụ huynh xem.
- Hoàn thành buổi học và lưu lịch sử.
- Teacher Dashboard hiển thị các buổi học gần nhất/sắp tới.
- Từ trang chi tiết lớp có thể mở lịch buổi học hoặc tạo buổi mới.
- Student/Parent Portal nhận dữ liệu chuyên cần và nhận xét mới từ buổi học.
- Thêm schema `class_sessions`, `session_attendance` và mở rộng `teacher_notes`.
- Thêm `npm run db:migrate` để cập nhật schema mà không seed lại dữ liệu.

## Công nghệ

- Node.js 20+
- Express 5
- EJS
- Bootstrap 5
- PostgreSQL
- Neon PostgreSQL qua `DATABASE_URL`
- `express-session` + `connect-pg-simple`

## Cài đặt

```bash
npm install
cp .env.example .env
npm run dev
```

## Cập nhật từ v0.2.2 lên v0.3.0

Nếu database Neon hiện đã có dữ liệu của v0.2.2, **không cần xóa database**.

Cấu hình `.env` trỏ tới Neon rồi chạy:

```bash
npm install
npm run db:migrate
```

Lệnh này chỉ chạy schema idempotent và bổ sung các bảng/cột của v0.3.0.

Nếu muốn tạo thêm dữ liệu mẫu cho Buổi học/Điểm danh/Nhận xét:

```bash
npm run db:init
```

`db:init` vừa chạy migration vừa seed dữ liệu demo, được thiết kế để có thể chạy lại an toàn ở mức MVP.

## Chạy với Neon

Trong `.env`:

```env
DEMO_MODE=false
DATABASE_URL=postgresql://<user>:<password>@<neon-pooler-host>/<database>?sslmode=require
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
```

Sau đó:

```bash
npm run db:migrate
npm start
```

Kiểm tra kết nối:

```text
GET /health
GET /health/db
```

## Render.com

Trong **Render Dashboard → Web Service → Environment**, giữ các biến đã cấu hình từ v0.2.2, đặc biệt:

```env
NODE_ENV=production
DEMO_MODE=false
DATABASE_URL=<Neon pooled connection string>
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
TRUST_PROXY=1
SESSION_SECURE=true
```

### Build / Start

```text
Build Command: npm install && npm run db:migrate
Start Command: npm start
```

Với Build Command trên, Render sẽ chạy migration idempotent trước mỗi lần deploy. Nếu muốn giữ Build Command chỉ là `npm install`, có thể chạy `npm run db:migrate` một lần từ máy local với cùng `DATABASE_URL` Neon.

## Routes mới v0.3.0

```text
GET  /sessions
GET  /sessions/new
POST /sessions
GET  /sessions/:id
POST /sessions/:id/attendance
POST /sessions/:id/notes
POST /sessions/:id/complete

GET  /api/v1/sessions
```

## Mô hình dữ liệu mới

```text
Class
  │
  └── ClassSession
        │
        ├── SessionAttendance
        │      ├── Student
        │      ├── status
        │      └── note
        │
        └── TeacherNote
               ├── Student
               ├── category
               └── is_parent_visible
```

### Trạng thái buổi học

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

### Trạng thái điểm danh

```text
PRESENT
LATE
ABSENT
ABSENT_EXCUSED
ONLINE
```

## PostgreSQL local

Để dùng PostgreSQL local, để trống:

```env
DATABASE_URL=
```

và cấu hình:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=english_classroom
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
```

Sau đó:

```bash
docker compose up -d
npm run db:init
npm run dev
```

## Tài khoản seed

Các tài khoản seed lấy từ `.env`:

- `DEMO_TEACHER_EMAIL` / `DEMO_TEACHER_PASSWORD`
- `DEMO_STUDENT_EMAIL` / `DEMO_STUDENT_PASSWORD`
- `DEMO_PARENT_EMAIL` / `DEMO_PARENT_PASSWORD`

## Cấu trúc

```text
src/
├── config/
├── middleware/
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── classes/
│   ├── students/
│   ├── sessions/        # v0.3.0
│   ├── portal/
│   └── health/
├── shared/
├── public/
├── views/
│   └── sessions/        # v0.3.0
├── app.js
└── server.js

db/schema.sql
scripts/init-db.js
scripts/migrate-db.js
```

## Bảo mật

- `.env` nằm trong `.gitignore`.
- Không commit `DATABASE_URL` lên GitHub.
- Production dùng `SESSION_SECURE=true`, `TRUST_PROXY=1` và `SESSION_SECRET` mạnh.
- Nhận xét nội bộ giáo viên có thể đặt `is_parent_visible=false`.
- CSRF protection, audit log và phân quyền nhiều giáo viên sẽ được bổ sung ở các phiên bản tiếp theo.
