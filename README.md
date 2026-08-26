# English Classroom MVP v0.2.0

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL.

## Vai trò hiện có

- Teacher: Dashboard, lớp học, học viên.
- Student: Trang chủ, bài tập, tài liệu, tiến độ học tập.
- Parent: Tổng quan con, chuyển nhiều con, điểm, chuyên cần, bài tập và nhận xét giáo viên.

## Chạy nhanh bằng Demo Mode

```bash
cp .env.example .env
npm install
npm run dev
```

Mở `http://localhost:3000`.

### Tài khoản demo

- Giáo viên: `teacher@demo.local` / `Teacher@123`
- Học sinh: `student@demo.local` / `Student@123`
- Phụ huynh: `parent@demo.local` / `Parent@123`

Mặc định `.env.example` dùng `DEMO_MODE=true`, không cần PostgreSQL.

## Chạy PostgreSQL thật

```bash
docker compose up -d
```

Đặt `DEMO_MODE=false` trong `.env`, sau đó:

```bash
npm run db:init
npm run dev
```

## Route chính

### Teacher
- `/dashboard`
- `/classes`
- `/students`

### Student
- `/student`
- `/student/assignments`
- `/student/materials`
- `/student/progress`

### Parent
- `/parent`
- `/parent/progress`

## Kiến trúc

```text
Route -> Controller -> Service -> Repository -> PostgreSQL / Demo Store
```

Portal học sinh/phụ huynh dùng chung lớp service/repository cho dữ liệu tiến độ học tập, nhưng có view và quyền truy cập riêng.
