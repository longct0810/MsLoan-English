# English Classroom MVP v0.6.1

Website responsive quản lý lớp học tiếng Anh dành cho giáo viên, học sinh và phụ huynh.

## Stack

- Node.js 20+
- Express 5 + EJS
- Bootstrap 5
- PostgreSQL / Neon
- `pg`
- `exceljs` + `multer` cho import Question Bank

## v0.6.1 có gì mới?

### 1. Giữ đầy đủ cách nhập câu hỏi thủ công

Tại `/questions`, giáo viên có hai lựa chọn rõ ràng:

```text
Nhập từng câu thủ công
hoặc
Nhập / cập nhật nhiều câu từ Excel
```

Khi nhập thủ công tại `/questions/new`, có hai nút:

```text
Lưu & thêm câu tiếp theo
Lưu & về ngân hàng
```

Phù hợp khi giáo viên đang soạn liên tục nhiều câu nhưng không muốn dùng Excel.

### 2. File Excel mẫu đơn giản hơn

Template mới bỏ các cột kỹ thuật như:

```text
action
lesson_id
difficulty
status
```

Giáo viên chỉ cần thao tác với các cột tiếng Việt:

```text
Mã câu hỏi
Khối
Loại câu hỏi
Nội dung câu hỏi
Đáp án A
Đáp án B
Đáp án C
Đáp án D
Đáp án / Gợi ý
Điểm
Giải thích / Hướng dẫn chấm
```

Quy tắc:

- `Mã câu hỏi` để trống => tạo mới.
- `Mã câu hỏi` có ID hiện có => cập nhật.
- Không cần nhập `CREATE` / `UPDATE`.
- `Loại câu hỏi` dùng tiếng Việt: Trắc nghiệm, Đúng/Sai, Điền từ, Tự luận.
- Câu mới import luôn lưu ở trạng thái `DRAFT` để giáo viên kiểm tra trước khi xuất bản.
- Các trường kỹ thuật cũ vẫn được parser hỗ trợ để không làm hỏng file template v0.6.0 đã có.

Template gồm 3 sheet:

```text
Nhap cau hoi  -> sheet giáo viên nhập dữ liệu
Vi du         -> ví dụ 4 loại câu hỏi
Huong dan     -> hướng dẫn ngắn gọn
```

Tải tại:

```text
/questions/import/template.xlsx
```

Import vẫn dùng nguyên tắc **all-or-nothing**: có một dòng lỗi thì không ghi bất kỳ dòng nào vào database.

### 3. Chấm bài hỗn hợp giữ nguyên từ v0.6.0

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

Điểm cuối chỉ được ghi vào tiến độ học sinh sau khi phần tự luận đã được chấm đầy đủ.

## Database

**v0.6.1 không thay đổi schema database.**

Nếu database đã ở v0.6.0 thì không cần chạy SQL migration mới.

Render vẫn có thể giữ Build Command:

```bash
npm install && npm run db:migrate
```

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

Version hiển thị trên giao diện được lấy từ `package.json` và hiện là `v0.6.1`.
