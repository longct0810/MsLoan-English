# English Classroom MVP v0.2.2

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL.

## Thay đổi v0.2.2

- Hỗ trợ `DATABASE_URL` cho Neon/hosted PostgreSQL.
- Ưu tiên `DATABASE_URL`; nếu để trống sẽ fallback về `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Hỗ trợ Neon pooled connection, SSL qua `sslmode=require` trong connection string.
- Bật channel binding bằng `DB_CHANNEL_BINDING=true`.
- Kiểm tra database khi startup bằng `DB_STARTUP_CHECK=true`.
- Thêm `GET /health` và `GET /health/db`.
- `db:init` dùng cùng cấu hình `DATABASE_URL`, vì vậy có thể khởi tạo schema/seed trực tiếp lên Neon.

## Cài đặt

```bash
npm install
cp .env.example .env
npm run dev
```

## Chạy với Neon

Trong `.env`:

```env
DEMO_MODE=false
DATABASE_URL=postgresql://<user>:<password>@<neon-pooler-host>/<database>?sslmode=require
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
```

Sau đó khởi tạo database:

```bash
npm run db:init
```

Rồi chạy ứng dụng:

```bash
npm start
```

Kiểm tra:

```text
GET /health
GET /health/db
```

`/health/db` chỉ trả trạng thái kết nối và latency, không trả host/user/password/connection string.

## Render.com

Trong **Render Dashboard → Web Service → Environment**, tối thiểu cần đặt:

```env
NODE_ENV=production
DEMO_MODE=false
DATABASE_URL=<Neon pooled connection string>
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
TRUST_PROXY=1
SESSION_SECURE=true
```

Ngoài ra giữ các biến cấu hình ứng dụng/session khác từ `.env.example`. Không đưa `DATABASE_URL` hoặc `.env` thật lên GitHub.

### Build / Start

```text
Build Command: npm install
Start Command: npm start
```

Nếu database Neon còn trống, chạy một lần từ máy local (với `DATABASE_URL` Neon trong `.env`):

```bash
npm run db:init
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

Có thể chạy PostgreSQL bằng Docker:

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
│   ├── env.js
│   └── db.js
├── middleware/
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── classes/
│   ├── students/
│   ├── portal/
│   └── health/
├── shared/
├── public/
├── views/
├── app.js
└── server.js

db/schema.sql
scripts/init-db.js
```

## Bảo mật

- `.env` đã nằm trong `.gitignore`.
- Không log `DATABASE_URL`.
- Production nên đặt `SESSION_SECURE=true`, `TRUST_PROXY=1` và dùng `SESSION_SECRET` mạnh.
- Nếu một database credential đã bị chia sẻ ở nơi không còn riêng tư, hãy rotate password/credential trên Neon và cập nhật `DATABASE_URL`.
