# English Classroom MVP v0.2.1

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL.

## Thay đổi v0.2.1

Toàn bộ cấu hình môi trường đã được gom về `.env` và đọc tập trung qua `src/config/env.js`.

Các nhóm cấu hình hiện nằm trong `.env`:

- Application: tên app, host, port, base URL, timezone, API prefix, body limit, trust proxy.
- Frontend assets: Bootstrap CSS/JS CDN.
- Session/cookie: secret, cookie name, thời gian sống, secure, sameSite, PostgreSQL session table.
- Demo/seed: bật/tắt demo, hiển thị tài khoản demo, tài khoản giáo viên/học sinh/phụ huynh, bcrypt rounds, năm học mặc định.
- PostgreSQL: host, port, database, user/password, SSL, pool size và timeout.
- Docker PostgreSQL: image, container port, container name, volume name.

> `.env` được cung cấp sẵn để chạy local. File này đã nằm trong `.gitignore`; khi đưa lên Git/production không commit secret thật.

## Chạy nhanh

```bash
npm install
npm run dev
```

Mở URL được cấu hình tại:

```env
APP_BASE_URL=http://localhost:3000
```

Nếu xóa `.env`, tạo lại từ mẫu:

```bash
cp .env.example .env
```

## Tài khoản demo

Tài khoản demo không còn hard-code trong source. Chỉnh trực tiếp trong `.env`:

```env
DEMO_TEACHER_EMAIL=teacher@demo.local
DEMO_TEACHER_PASSWORD=Teacher@123

DEMO_STUDENT_EMAIL=student@demo.local
DEMO_STUDENT_PASSWORD=Student@123

DEMO_PARENT_EMAIL=parent@demo.local
DEMO_PARENT_PASSWORD=Parent@123
```

Để ẩn tài khoản demo khỏi màn hình login:

```env
SHOW_DEMO_ACCOUNTS_ON_LOGIN=false
```

## Demo Mode

```env
DEMO_MODE=true
```

Không cần PostgreSQL, ứng dụng dùng dữ liệu mẫu trong `src/shared/demo-store.js`.

## PostgreSQL thật

Khởi động PostgreSQL bằng Docker:

```bash
docker compose up -d
```

Docker Compose dùng trực tiếp các biến trong `.env` như `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, `POSTGRES_IMAGE`.

Sau đó đổi:

```env
DEMO_MODE=false
```

Khởi tạo database:

```bash
npm run db:init
npm run dev
```

## Production gợi ý

Tối thiểu nên đổi:

```env
NODE_ENV=production
APP_BASE_URL=https://your-domain.example
SESSION_SECRET=<chuoi-ngau-nhien-dai>
SESSION_SECURE=true
TRUST_PROXY=1
SHOW_DEMO_ACCOUNTS_ON_LOGIN=false
DEMO_MODE=false
DB_PASSWORD=<mat-khau-manh>
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

## Kiến trúc cấu hình

```text
.env
  ↓
src/config/env.js
  ├── app
  ├── assets
  ├── session
  ├── demo
  ├── security
  ├── academic
  └── db
       ↓
Các module sử dụng config đã parse/validate
```

Không đọc `process.env` trực tiếp rải rác trong các module.
