# v0.21.1 - Google Sheets Score Visibility & Progress Hotfix

## Fixed

- Đồng bộ điểm từ Google Sheets đã ghi `student_scores` nhưng trước đây không refresh `student_progress_summary`, khiến Dashboard/Class/Student UI vẫn có thể hiển thị điểm trung bình cũ (thường là 0).
- `Đồng bộ ngay` giờ luôn re-process dữ liệu dù Sheet không thay đổi. Scheduler định kỳ vẫn dùng SHA-256 để bỏ qua dữ liệu không đổi.
- Sau khi materialize điểm hoặc điểm danh, hệ thống refresh lại `average_score` và `attendance_rate` cho các học sinh bị tác động trong cùng transaction.
- Trang chi tiết assessment hiển thị rõ `Đã ghi điểm` và giá trị thực tế đã lưu trong `student_scores`.
- Thông báo sync hiển thị số bài test và số điểm đã ghi DB để dễ chẩn đoán.

## Database

Không cần migration từ v0.21.0. Sau deploy, bấm **Đồng bộ ngay** để backfill lại progress summary và xác nhận điểm.
