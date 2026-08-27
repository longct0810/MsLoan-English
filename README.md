# English Classroom MVP v0.5.0

Responsive web app cho lớp học tiếng Anh, xây dựng bằng Node.js + Express + EJS + Bootstrap + PostgreSQL/Neon.

## Thay đổi chính v0.5.0

### Question Bank

- Ngân hàng câu hỏi dùng lại cho nhiều bài kiểm tra.
- Hỗ trợ 3 loại câu hỏi:
  - `MULTIPLE_CHOICE` - trắc nghiệm 2–4 lựa chọn.
  - `TRUE_FALSE` - đúng/sai.
  - `FILL_BLANK` - điền từ/câu trả lời ngắn.
- Phân loại theo khối 6/7/8/9, bài học, độ khó và trạng thái.
- Điểm mặc định cho từng câu.
- Giải thích đáp án.
- Lưu nháp, chỉnh sửa và xuất bản.

### Exam Builder

- Giáo viên tạo bài kiểm tra theo lớp.
- Chọn câu hỏi đã xuất bản từ Question Bank.
- Hệ thống lọc câu hỏi theo khối của lớp ở UI và kiểm tra lại ở server.
- Cấu hình:
  - thời lượng làm bài;
  - thời gian mở/đóng đề;
  - số lần làm tối đa;
  - có/không hiển thị đáp án sau khi nộp.
- Bài kiểm tra được tạo ở trạng thái `DRAFT`.
- Có thể sửa đề khi còn là bản nháp.
- Xuất bản và đóng đề.
- Teacher view hiển thị số lượt nộp, điểm trung bình và kết quả từng học sinh.

### Student Online Exam

- Danh sách bài kiểm tra dành riêng cho lớp của học sinh.
- Bắt đầu / tiếp tục lượt làm bài.
- Countdown theo thời gian làm bài.
- Tự động lưu từng đáp án qua API.
- Khôi phục đáp án khi reload trang.
- Tự nộp khi hết giờ.
- Server từ chối lưu đáp án sau khi hết thời gian.
- Hỗ trợ nhiều lần làm theo cấu hình đề.

### Auto grading

- Tự chấm:
  - Multiple Choice;
  - True / False;
  - Fill Blank (so sánh không phân biệt hoa/thường và bỏ khoảng trắng đầu/cuối).
- Lưu `is_correct` và điểm từng câu.
- Tính tổng điểm bài kiểm tra.
- Ghi kết quả vào `student_scores` với category `EXAM`.
- Tính lại `student_progress_summary.average_score`.
- Nếu giáo viên cho phép, học sinh xem:
  - câu đúng/sai;
  - đáp án đúng;
  - điểm từng câu;
  - giải thích đáp án.

### Version

Version lấy tự động từ `package.json`:

```json
"version": "0.5.0"
```

Hiển thị tại Login / Navbar / Sidebar / Footer và `/health`, `/health/db`.

## Luồng hiện tại

```text
Teacher
  │
  ├── Class Session → Attendance → Student Note
  ├── Lesson → Material
  ├── Assignment → Submission → Manual Grade
  └── Question Bank
          ↓
      Exam Builder
          ↓
      Publish Exam
          ↓
Student Portal
  │
  ├── Start Exam
  ├── Countdown
  ├── Autosave Answer
  ├── Submit / Auto Submit
  └── Result / Explanation
          ↓
     Student Scores
          ↓
 Student / Parent Progress
```

## Công nghệ

- Node.js 20+
- Express 5
- EJS
- Bootstrap 5
- PostgreSQL / Neon PostgreSQL
- `pg`
- `express-session` + `connect-pg-simple`

## Upgrade Neon từ v0.4.x lên v0.5.0

Cách khuyến nghị trên Render:

```text
Build Command: npm install && npm run db:migrate
Start Command: npm start
```

Hoặc chạy thủ công trong Neon SQL Editor:

```text
db/neon_upgrade_v0.5.0.sql
```

Script không `DROP TABLE` và không xóa dữ liệu cũ.

Nếu DB hiện tại đã nâng schema và anh muốn thêm riêng demo Question Bank/Exam của v0.5.0, chạy một lần:

```text
db/neon_seed_v0.5.0_demo.sql
```

Nếu tạo database mới hoàn toàn và muốn có demo data:

```text
db/neon_init_v0.5.0_demo.sql
```

## Database mới v0.5.0

```text
questions
question_options
exams
exam_questions
exam_attempts
exam_answers
```

Mở rộng:

```text
student_scores
  + exam_id
```

## Routes v0.5.0

### Teacher - Question Bank

```text
GET  /questions
GET  /questions/new
POST /questions
GET  /questions/:id/edit
POST /questions/:id/update
POST /questions/:id/publish
GET  /api/v1/questions
```

### Teacher - Exams

```text
GET  /exams
GET  /exams/new
POST /exams
GET  /exams/:id
GET  /exams/:id/edit
POST /exams/:id/update
POST /exams/:id/publish
POST /exams/:id/close
```

### Student - Exams

```text
GET  /student/exams
POST /student/exams/:id/start
GET  /student/exam-attempts/:id
POST /student/exam-attempts/:id/submit
GET  /student/exam-attempts/:id/result
POST /api/v1/exam-attempts/:id/answers
```

## Render + Neon

Environment tối thiểu:

```env
NODE_ENV=production
DEMO_MODE=false
DATABASE_URL=<Neon pooled connection string>
DB_CHANNEL_BINDING=true
DB_STARTUP_CHECK=true
TRUST_PROXY=1
SESSION_SECURE=true

# Có thể override nếu cần
EXAM_DEFAULT_DURATION_MINUTES=30
EXAM_MAX_DURATION_MINUTES=360
EXAM_DEFAULT_MAX_ATTEMPTS=1
EXAM_MAX_ATTEMPTS=10
EXAM_AUTOSAVE_DEBOUNCE_MS=500
QUESTION_DEFAULT_POINTS=1
QUESTION_MAX_POINTS=100
```

Không commit `.env` lên GitHub. Các biến mới có giá trị fallback trong code nên Render cũ vẫn chạy nếu chưa khai báo chúng.

Sau deploy kiểm tra:

```text
GET /health
GET /health/db
```

## Cài local

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

Mở `http://localhost:3000`.

## Cấu trúc module

```text
src/modules/
├── auth/
├── dashboard/
├── classes/
├── students/
├── sessions/
├── lessons/
├── assignments/
├── questions/       # v0.5.0
├── exams/           # v0.5.0
├── portal/
└── health/
```

## Hướng tiếp theo

Ưu tiên cho v0.6.0:

1. Báo cáo lớp/học sinh và phân tích kết quả theo kỹ năng/chủ đề.
2. Import câu hỏi từ Excel/CSV.
3. Reading passage + nhóm câu hỏi chung.
4. Listening question có audio.
5. Notification cho học sinh/phụ huynh.
6. File Storage thực tế S3/R2/MinIO.
7. CSRF protection, audit log và quản lý nhiều giáo viên.
