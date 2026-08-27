# Changelog

## v0.5.0

- Thêm Question Bank với Multiple Choice, True/False và Fill Blank.
- Phân loại câu hỏi theo khối, bài học, độ khó, điểm và trạng thái.
- Thêm Exam Builder theo lớp và ngân hàng câu hỏi.
- Bài kiểm tra hỗ trợ thời lượng, thời gian mở/đóng, số lần làm và chế độ hiển thị kết quả.
- Cho phép sửa đề khi còn DRAFT, xuất bản và đóng đề.
- Thêm Student Exam UI, countdown và autosave từng đáp án.
- Tự động nộp khi hết thời gian; server chặn lưu đáp án quá hạn.
- Auto grading cho trắc nghiệm, đúng/sai và điền từ.
- Lưu kết quả vào student_scores và cập nhật điểm trung bình.
- Học sinh xem đáp án/giải thích nếu đề cho phép.
- Thêm schema questions, question_options, exams, exam_questions, exam_attempts, exam_answers.
- Thêm `student_scores.exam_id`.
- Thêm `db/neon_upgrade_v0.5.0.sql` và `db/neon_init_v0.5.0_demo.sql`.

## v0.4.0

- Thêm quản lý Bài học theo lớp / Unit.
- Thêm quản lý tài liệu gắn với bài học và URL tài nguyên.
- Thêm chỉnh sửa và xuất bản bài học.
- Thêm quản lý/chỉnh sửa Bài tập và trạng thái nháp/đã giao.
- Thêm theo dõi số học sinh đã nộp và đã chấm.
- Học sinh có thể mở và nộp nội dung bài tập.
- Giáo viên chấm điểm và nhập phản hồi.
- Điểm bài tập đồng bộ vào lịch sử điểm và điểm trung bình.
- Thêm schema `lessons` và mở rộng `materials`, `assignments`, `assignment_submissions`, `student_scores`.
- Hiển thị version ứng dụng trên Login / Navbar / Sidebar / Footer.
- `/health` và `/health/db` trả thêm version.
- Thêm `db/neon_upgrade_v0.4.0.sql`.

## v0.3.0

- Buổi học.
- Điểm danh.
- Nhận xét học viên theo buổi.
- Đồng bộ chuyên cần sang Student/Parent Portal.

## v0.2.x

- Student Portal.
- Parent Portal.
- Role-based access.
- Neon `DATABASE_URL`.

## v0.1.0

- Teacher Dashboard.
- Lớp học.
- Học viên.
