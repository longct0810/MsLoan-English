# v0.22.0 - Student Learning Profile & Skill Analytics

- Thêm Hồ sơ học tập giáo viên tại `/students/:id` với điểm, nguồn điểm, chuyên cần, kỹ năng, bài tập/test và nhận xét theo lớp/tháng.
- Danh sách Học viên có nút **Xem**.
- `/skills` chuyển nguồn chuẩn từ `student_skills` sang `student_skill_events`, class-scoped, có số lần đánh giá và xu hướng 2 lần gần nhất.
- Báo cáo giáo viên, Student Portal và Parent Report đọc skill analytics từ `student_skill_events`, nên dùng được dữ liệu Google Sheets (`source_type=EXTERNAL`).
- Chi tiết assessment Google Sheets cho phép giáo viên chỉnh `skill_code` hoặc chọn Không tính kỹ năng; lần sync kế tiếp tái materialize theo mapping mới.
- Giữ `student_skills` để backward compatibility nhưng UI chính không còn phụ thuộc bảng này.
- Thêm index analytics `idx_student_skill_events_student_class_skill_date`.
