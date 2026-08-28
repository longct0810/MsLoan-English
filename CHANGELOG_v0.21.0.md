# v0.21.0 - Google Sheets Assessment Mapping

Ngày phát hành: 28/08/2026
Baseline: v0.20.2

## Tính năng mới
- Nhận diện một bài test/assessment từ một hoặc nhiều cột liền nhau trong Google Sheets.
- Hiểu cặp điểm quy đổi `/10` và số câu đúng/thang điểm gốc, ví dụ `5.5 + 11` với header `/20` => `11/20 = 5.5/10`.
- Có thể suy luận thang điểm khi Sheet chỉ có cặp tương đương, ví dụ `8.75 + 35` => `35/40 = 8.75/10`.
- Lưu định nghĩa bài test vào `external_assessments` và kết quả từng học sinh vào `external_assessment_results`.
- Giữ cả `raw_score/raw_max_score` và `normalized_score/normalized_max_score`.
- Materialize an toàn vào `student_scores` và `student_skill_events` sau khi học sinh đã mapping.
- Không tạo giả `exam_attempt` hoặc `assignment_submission` từ dữ liệu Google Sheets.
- Giáo viên có thể map bài test ngoài Sheet với Exam/Assignment có sẵn trong đúng lớp hoặc giữ ở trạng thái bài ngoài hệ thống.
- Mapping bài test và mapping học sinh đều reset content hash để lần sync kế tiếp áp dụng ngay cả khi Sheet không thay đổi.
- Migration tự reset hash của các nguồn Google Sheets hiện có để tạo assessment lần đầu sau nâng cấp.

## Tương thích dữ liệu v0.20.x
- Tái sử dụng `external-observation:<id>` làm `source_ref` khi có thể, giúp cập nhật score đã materialize ở v0.20.x thay vì tạo duplicate.
- Raw observations vẫn được giữ nguyên để audit.

## Database
Chạy `db/neon_upgrade_v0.21.0.sql` sau khi đã ở v0.20.0+.
