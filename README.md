> Phiên bản hiện tại: **v0.22.0** – Student Learning Profile & Skill Analytics.

# English Classroom v0.22.0

> v0.22.0: Student Learning Profile & Skill Analytics — hồ sơ học viên, theo dõi kỹ năng dựa trên `student_skill_events` và mapping kỹ năng từ Google Sheets.
> v0.21.1: Score Visibility & Progress Hotfix — đồng bộ Google Sheets refresh tiến độ học sinh và manual sync luôn re-process dữ liệu.

Website responsive quản lý lớp học tiếng Anh dành cho giáo viên, học viên và phụ huynh.

## Công nghệ
- Node.js 20+
- Express 5 + EJS
- Bootstrap 5
- PostgreSQL / Neon
- `pg`, `bcryptjs`, `express-session`, `connect-pg-simple`
- ExcelJS + Multer cho import Question Bank

## Chức năng chính



### Teacher Report Center v0.18.0
- Báo cáo giáo viên tại `/reports`, lọc theo tháng và lớp.
- KPI: số học viên, điểm trung bình /10, chuyên cần, tỷ lệ nộp bài, số bài/bài thi chờ chấm.
- Tổng quan theo lớp và danh sách học viên cần chú ý dựa trên điểm, chuyên cần và bài quá hạn.
- Báo cáo chi tiết từng học viên gồm điểm, bài tập, kiểm tra, chuyên cần, kỹ năng hiện có và nhận xét gắn với buổi học.
- Xuất CSV, Excel `.xlsx` và In / lưu PDF.
- Toàn bộ report được scope theo class ownership của TEACHER; ADMIN được xem toàn cục.
- `student_scores` có thêm `class_id` để tránh score của class khác lọt vào báo cáo multi-teacher.

### Nâng database từ v0.14.1 lên v0.18.0
Chạy thủ công trên Neon SQL Editor **trước khi deploy source v0.18.0**:

```text
db/neon_upgrade_v0.18.0.sql
```

Migration chỉ thêm `student_scores.class_id`, backfill an toàn dữ liệu cũ và tạo index phục vụ báo cáo. Không xóa dữ liệu hiện có.

### Account Security v0.14.1
- Tất cả tài khoản `ADMIN`, `TEACHER`, `STUDENT`, `PARENT` có thể tự đổi mật khẩu tại `/account/password`.
- Bắt buộc nhập đúng mật khẩu hiện tại.
- Mật khẩu mới từ 8 đến 128 ký tự, phải khớp xác nhận và khác mật khẩu hiện tại.
- Sau khi đổi mật khẩu, session hiện tại được regenerate để xoay session id.
- Không cần cập nhật schema/database khi nâng từ v0.14.0 lên v0.14.1.

### Hardening v0.14.0
- Scope Student CRUD theo class ownership của TEACHER; ADMIN giữ quyền toàn cục.
- Scope Session/Attendance/Teacher Note/Complete Session theo owner của class.
- Dashboard chỉ tổng hợp lớp, học viên, bài tập và buổi học thuộc phạm vi actor.
- Assignment kiểm tra lesson phải thuộc đúng class và thuộc phạm vi giáo viên.
- Exam update kiểm tra lại class đích để chặn chuyển Exam sang class không sở hữu.
- Question Bank lọc lesson theo ownership; import UPDATE chỉ sửa question actor có quyền quản lý.
- Multipart question import bắt buộc CSRF token sau khi Multer parse form.
- Mở rộng `assignment_submissions.score`, `student_scores.score/max_score` thành `NUMERIC(8,2)`.
- Thêm migration `db/neon_upgrade_v0.14.0.sql` và test hardening.

Nâng database theo từng version bằng file upgrade tương ứng trên Neon SQL Editor. Ví dụ:

```text
db/neon_upgrade_v0.14.0.sql
db/neon_upgrade_v0.18.0.sql
```

> Không dùng `npm run db:migrate` trên database production hiện có vì script này vẫn đang chạy toàn bộ `db/schema.sql`.

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

### Bảo mật và trải nghiệm v0.8.0
- CSRF token theo session cho form và API request.
- Chặn request thay đổi dữ liệu từ origin/referer khác với host ứng dụng.
- Regenerate session sau khi đăng nhập.
- Giáo viên chỉ xem và thay đổi lớp do mình phụ trách; ADMIN vẫn có quyền toàn cục.
- Lessons, assignments, questions và exams cũng được kiểm tra ownership trước khi xem hoặc thay đổi.
- Exam chỉ cho phép chọn question bank thuộc phạm vi của actor.
- Navigation được nhóm theo lớp học và nội dung/đánh giá, có trạng thái active trên mobile.
- `npm test` kiểm tra các lớp bảo mật nền tảng.

### Báo cáo phụ huynh v0.9.0
- Báo cáo học tập theo tháng tại `/parent/reports`.
- KPI điểm trung bình, chuyên cần, bài đã nộp và kỹ năng cần ưu tiên.
- Xu hướng điểm, phân tích bài tập, chuyên cần và nhận xét giáo viên.
- Lọc theo tháng và chọn từng người con trong tài khoản phụ huynh.
- Xuất báo cáo CSV tương thích Excel tại `/parent/reports.csv`.
- In báo cáo hoặc lưu thành PDF trực tiếp từ trình duyệt.

### Thông báo phụ huynh v0.11.0
- Trung tâm thông báo tại `/parent/notifications`.
- Cảnh báo bài sắp hạn, bài nộp trễ và cập nhật chuyên cần.
- Thông báo điểm mới và nhận xét giáo viên.
- Nội dung được giới hạn theo người con đã liên kết với tài khoản phụ huynh.
- Có thể đánh dấu từng thông báo là đã đọc.
- Có thể đánh dấu tất cả thông báo hiện tại là đã đọc.

Email và push notification chưa bật trong bản này vì cần cấu hình nhà cung cấp gửi tin bên ngoài.

Migration PostgreSQL cho v0.12.0:

```text
db/neon_upgrade_v0.12.0.sql
```

Để lưu PDF, mở `/parent/reports`, chọn tháng rồi nhấn `In / PDF` và chọn máy in `Save to PDF`.

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

Nếu nâng database production từ phiên bản cũ, chạy tuần tự các file `db/neon_upgrade_v*.sql` cần thiết trên Neon SQL Editor. Với database đã ở v0.14.0 thì **v0.14.1 không cần chạy SQL**.

Không chạy `npm run db:migrate` trên database production hiện có cho đến khi migration runner mới được triển khai.

Build Command trên Render:

```bash
npm ci
```

Migration production được chạy thủ công theo từng file upgrade trước khi deploy code.

Start Command:

```bash
npm start
```


## Route mới v0.14.1

```text
GET  /account/password
POST /account/password
```

Route dùng `requireAuth`, áp dụng cho ADMIN, TEACHER, STUDENT và PARENT.

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


## v0.18.0
Sổ đầu bài điện tử được tích hợp trực tiếp vào chi tiết buổi học. Khi nâng từ v0.15.0, chạy `db/neon_upgrade_v0.18.0.sql` trên Neon trước khi deploy.


## v0.18.0
Skill Tracking: chạy `db/neon_upgrade_v0.18.0.sql` sau khi database đã ở v0.16.0.


## v0.18.0
Assignment 2.0 lưu tệp bài nộp trong PostgreSQL/Neon (phù hợp quy mô lớp nhỏ). Trước production lớn nên chuyển binary sang object storage. Chạy `db/neon_upgrade_v0.18.0.sql` sau v0.17.0.
