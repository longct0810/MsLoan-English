# English Classroom MVP v0.7.0

Website responsive quản lý lớp học tiếng Anh dành cho giáo viên, học viên và phụ huynh.

## Công nghệ
- Node.js 20+
- Express 5 + EJS
- Bootstrap 5
- PostgreSQL / Neon
- `pg`, `bcryptjs`, `express-session`, `connect-pg-simple`
- ExcelJS + Multer cho import Question Bank

## Chức năng chính đến v0.7.0

### Teacher Portal
- Dashboard.
- CRUD lớp học khối 6–9.
- CRUD học viên.
- Gắn học viên vào một hoặc nhiều lớp.
- Tạo tài khoản STUDENT và PARENT cùng lúc khi thêm học viên.
- Dùng lại tài khoản phụ huynh nếu cùng email đã tồn tại.
- Buổi học, điểm danh, nhận xét học viên.
- Bài học & tài liệu.
- Bài tập, nộp bài và chấm bài.
- Question Bank: nhập thủ công hoặc import/update Excel/CSV.
- Online Exam: trắc nghiệm tự chấm + tự luận giáo viên chấm.

### Student Portal
- Dashboard, tài liệu, bài tập, tiến độ.
- Làm bài kiểm tra online, autosave, countdown, xem kết quả.

### Parent Portal
- Theo dõi nhiều con trên cùng một tài khoản phụ huynh.
- Điểm, chuyên cần, bài tập và nhận xét giáo viên.

## Luồng tạo học viên v0.7.0

```text
Teacher tạo học viên
       │
       ├─ Student profile
       ├─ STUDENT user account
       ├─ Class membership
       │
       └─ Parent information
              │
              ├─ email PARENT đã tồn tại → dùng lại
              └─ chưa tồn tại → tạo PARENT account
                         │
                         └─ parent_students
```

Email học viên và email phụ huynh phải khác nhau. Mật khẩu học viên tối thiểu 8 ký tự. Với phụ huynh mới, cần nhập mật khẩu; nếu email phụ huynh đã có tài khoản PARENT thì có thể để trống mật khẩu để dùng lại tài khoản đó.

## Xóa an toàn
Nút **Xóa** học viên/lớp dùng soft delete. Dữ liệu điểm, bài kiểm tra, bài tập, chuyên cần và lịch sử không bị xóa vật lý khỏi PostgreSQL.

## Chạy local

```bash
cp .env.example .env
npm install
npm run dev
```

Demo mode:

```env
DEMO_MODE=true
```

## PostgreSQL / Neon
Production dùng:

```env
DEMO_MODE=false
DATABASE_URL=postgresql://...
```

Nâng database hiện tại từ v0.6.x:

```bash
npm run db:migrate
```

Hoặc chạy thủ công trên Neon SQL Editor:

```text
db/neon_upgrade_v0.7.0.sql
```

Build Command trên Render:

```bash
npm install && npm run db:migrate
```

Start Command:

```bash
npm start
```

## Route mới v0.7.0

```text
GET  /students/new
POST /students
GET  /students/:id/edit
POST /students/:id
POST /students/:id/delete

GET  /classes/new
POST /classes
GET  /classes/:id/edit
POST /classes/:id
POST /classes/:id/delete
```

## Version
Version hiện tại được lấy từ `package.json` và hiển thị trên Login, Navbar, Sidebar, Footer và health endpoint.
