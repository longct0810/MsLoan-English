# Roadmap sau v0.15.0

## Nguyên tắc ưu tiên
1. Hoàn thiện các luồng giáo viên đang còn thiếu trước khi bổ sung AI.
2. Tận dụng dữ liệu đã có (lớp, buổi học, điểm danh, bài tập, kiểm tra, phụ huynh) thay vì tạo module rời rạc.
3. Mỗi phiên bản lớn phải có test authorization, integration DB và migration an toàn.

## ✅ v0.15.0 — Teacher Report Center
Đã hoàn thành: báo cáo theo lớp/tháng, KPI, học viên cần chú ý, chi tiết học viên, CSV/Excel/Print-PDF và class-scoped authorization.

## v0.16.0 — Sổ đầu bài điện tử
- Tối ưu luồng mở buổi học → điểm danh → nội dung đã dạy → bài tập về nhà → nhận xét → hoàn thành buổi học.
- Template nội dung buổi học và sao chép từ buổi trước.
- Nhận xét nhanh theo học sinh và mẫu nhận xét.
- Khi hoàn thành buổi học, tự cập nhật tiến độ và tạo thông báo cho phụ huynh.
- Trang lịch sử sổ đầu bài theo lớp/tháng.

## v0.17.0 — Skill Tracking
- Chuẩn hóa kỹ năng: Vocabulary, Grammar, Reading, Listening, Writing, Speaking, Pronunciation.
- Gắn skill vào Question, Assignment, Exam và Lesson.
- Tự động tổng hợp năng lực học sinh theo dữ liệu làm bài.
- Biểu đồ tiến bộ theo kỹ năng và theo thời gian.
- Hiển thị điểm mạnh/điểm yếu trên Teacher, Student và Parent Portal.

## v0.18.0 — Assignment & Speaking 2.0
- Nộp file PDF/Word/image/audio thay vì chỉ text.
- Bài Speaking cho phép học sinh ghi âm hoặc upload audio.
- Rubric chấm Speaking: pronunciation, fluency, vocabulary, grammar.
- Lưu feedback theo tiêu chí và tổng điểm.

## v0.19.0 — Exam 2.0
- Sinh đề từ Question Pool theo khối, bài học, skill và difficulty.
- Random câu hỏi và random đáp án.
- Pass score, reset attempt, gia hạn riêng cho học sinh, mở lại bài thi.
- Phân tích kết quả theo câu hỏi và kỹ năng.

## v0.20.0 — Notification Center 2.0
- Chuyển notification từ dữ liệu sinh động sang entity có `id`, `recipient`, `type`, `entity_id`, `read_at`.
- Trigger cho vắng/đi muộn, bài sắp hạn, quá hạn, điểm mới, nhận xét, báo cáo tháng.
- Chuẩn bị adapter cho Email/Zalo/Push nhưng giữ in-app là kênh mặc định.

## v0.21.0 — Learning Intelligence / AI
- Phát hiện xu hướng giảm điểm/chuyên cần và học sinh cần chú ý.
- Gợi ý kỹ năng cần luyện và bài tập phù hợp.
- Tạo bản nháp nhận xét/báo cáo để giáo viên duyệt trước khi gửi.
- Chỉ triển khai sau khi Skill Tracking và dữ liệu lịch sử đủ ổn định.

## Technical track chạy song song
- Thay `schema.sql` migration bằng migration runner có bảng `schema_migrations`.
- Integration test với PostgreSQL thật cho các flow quan trọng.
- ESLint + Prettier + CI chạy test trước deploy.
- Audit log cho các thao tác quan trọng: đổi mật khẩu, chấm điểm, sửa điểm danh, import/update câu hỏi.
- Tùy chọn buộc đổi mật khẩu lần đầu và reset mật khẩu có thời hạn cho STUDENT/PARENT.
