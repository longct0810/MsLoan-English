# English Classroom MVP v0.6.0

Website responsive quản lý lớp học tiếng Anh dành cho giáo viên, học sinh và phụ huynh.

## Stack

- Node.js 20+
- Express 5 + EJS
- Bootstrap 5
- PostgreSQL / Neon
- `pg`
- `exceljs` + `multer` cho import Question Bank

## v0.6.0 có gì mới?

### 1. Import / Update Question Bank từ file

Mở:

```text
/questions/import
```

Hỗ trợ:

```text
.xlsx
.csv
```

Tải template tại:

```text
/questions/import/template.xlsx
```

Các cột chính:

```text
action
id
grade
lesson_id
question_type
stem
option_a
option_b
option_c
option_d
correct_option
correct_answer
explanation
difficulty
points
status
```

`action` nhận `CREATE` hoặc `UPDATE`. Nếu bỏ trống, có `id` thì UPDATE, không có `id` thì CREATE.

Các `question_type`:

```text
MULTIPLE_CHOICE
TRUE_FALSE
FILL_BLANK
ESSAY
```

Import dùng nguyên tắc **all-or-nothing**: nếu có một dòng không hợp lệ thì không cập nhật bất kỳ dòng nào.

### 2. Chấm bài hỗn hợp tự động + thủ công

```text
Student submits exam
        |
        +--> MCQ / TRUE_FALSE / FILL_BLANK
        |        -> Auto grading
        |
        +--> ESSAY
                 -> PENDING_GRADING
                 -> Teacher grades
                 -> Final score
```

Giáo viên mở chi tiết bài kiểm tra và bấm **Chấm tự luận** ở lượt làm đang chờ chấm.

Điểm cuối chỉ được ghi vào tiến độ học sinh sau khi phần tự luận đã được chấm đầy đủ.

## Cấu hình import trong `.env`

```env
QUESTION_IMPORT_MAX_ROWS=2000
QUESTION_IMPORT_MAX_FILE_MB=5
```

## Cài đặt

```bash
cp .env.example .env
npm install
npm run dev
```

## Cập nhật Neon từ v0.5.0

Có thể để Render chạy:

```bash
npm install && npm run db:migrate
```

Hoặc chạy thủ công:

```text
db/neon_upgrade_v0.6.0.sql
```

Dữ liệu demo tự luận:

```text
db/neon_seed_v0.6.0_demo.sql
```

## Render

Build Command:

```bash
npm install && npm run db:migrate
```

Start Command:

```bash
npm start
```

`DATABASE_URL` tiếp tục đặt trong **Render → Environment**, không commit `.env` lên GitHub.

## Health check

```text
/health
/health/db
```

Version hiển thị trên giao diện được lấy từ `package.json` và hiện là `v0.6.0`.
