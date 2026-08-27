# Changelog

## v0.6.1

### Question Bank UX
- Giữ và làm nổi bật lựa chọn nhập câu hỏi thủ công từng câu tại `/questions/new`.
- Thêm nút `Lưu & thêm câu tiếp theo` để giáo viên soạn liên tục.
- Màn hình Question Bank hiển thị rõ hai cách: nhập từng câu hoặc nhập từ Excel.

### Excel import thân thiện với giáo viên
- Template mới dùng tiêu đề tiếng Việt và giảm từ 16 xuống 11 cột.
- Bỏ yêu cầu nhập các cột kỹ thuật `action`, `lesson_id`, `difficulty`, `status`.
- `Mã câu hỏi` để trống = tạo mới; có ID = cập nhật.
- Hỗ trợ tên loại câu hỏi bằng tiếng Việt.
- Câu mới import mặc định là `DRAFT`.
- Template có sheet nhập trống, sheet ví dụ và sheet hướng dẫn.
- Parser vẫn tương thích ngược với file v0.6.0.

### Database
- Không thay đổi schema so với v0.6.0.

## v0.6.0

### Question Bank
- Thêm loại câu hỏi `ESSAY` (tự luận).
- Thêm màn hình import/cập nhật hàng loạt câu hỏi từ `.xlsx` hoặc `.csv`.
- Có file mẫu tải trực tiếp tại `/questions/import/template.xlsx`.
- Import hỗ trợ `CREATE` và `UPDATE` theo `id`.
- Kiểm tra toàn bộ file trước khi ghi: nếu có bất kỳ dòng lỗi, database không bị cập nhật một phần.
- Hỗ trợ các loại câu hỏi trong file: `MULTIPLE_CHOICE`, `TRUE_FALSE`, `FILL_BLANK`, `ESSAY`.

### Exam grading
- Trắc nghiệm, đúng/sai và điền từ tiếp tục được tự động chấm.
- Câu `ESSAY` được chuyển sang trạng thái chờ giáo viên chấm.
- Lượt làm có câu tự luận chuyển thành `PENDING_GRADING` sau khi nộp.
- Giáo viên có màn hình chấm từng câu tự luận, nhập điểm và phản hồi.
- Sau khi chấm đủ tự luận, hệ thống tổng hợp điểm tự động + điểm thủ công và chuyển lượt làm sang `GRADED`.
- Chỉ khi hoàn tất chấm, điểm cuối mới được ghi vào `student_scores` và cập nhật tiến độ học viên.
- Học sinh thấy trạng thái "Chờ giáo viên chấm tự luận" và nhận xét sau khi chấm.

### Database
- `questions.question_type` hỗ trợ thêm `ESSAY`.
- `exam_attempts.status` hỗ trợ `PENDING_GRADING`.
- `exam_attempts.auto_score` lưu phần điểm hệ thống tự chấm.
- `exam_answers` bổ sung `grading_status`, `teacher_feedback`, `graded_by`, `graded_at`.

## v0.5.0
- Question Bank.
- Online Exam Builder.
- Countdown + autosave.
- Auto grading cho câu hỏi khách quan.
- Analytics theo câu hỏi.

## v0.4.0
- Bài học, tài liệu, bài tập, nộp bài và chấm bài.

## v0.3.0
- Buổi học, điểm danh, nhận xét học viên.
