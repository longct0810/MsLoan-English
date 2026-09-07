# v0.25.0 - Google Sheets Schema Profiles & Dry-run Validation

## Added

- Mỗi `external_data_sources` có `settings.sheet_profile` riêng, không còn giả định 4 Google Sheet phải cùng cấu trúc.
- Hỗ trợ các mode: `AUTO`, `SINGLE_ROW`, `DATE_THEN_FIELD`, `FIELD_WITH_DATE_ABOVE`, `CUSTOM`.
- Cho phép cấu hình độc lập theo nguồn: header row, date row, field row, data start row, cột STT, cột Họ và Tên.
- Cho phép khai báo alias điểm danh bổ sung như `CC`, `Có mặt`.
- Cho phép override từng cột: loại dữ liệu (`ATTENDANCE`, `SCORE`, `NOTE`, `HOMEWORK_STATUS`, `LEVEL`, `TEXT`, `IGNORE`), tên field và ngày.
- Màn `/teacher/data-sources/:id/schema` có preview CSV logical row, Dry-run và thống kê học viên/điểm danh/điểm số/bài test trước khi ghi dữ liệu nghiệp vụ.
- Profile phải được **Xác nhận** trước khi materialize nếu `require_confirmed_sheet_profile=true`.

## Safety

- Nguồn chưa xác nhận vẫn được tải và lưu staging/audit nhưng không ghi `student_scores`, `session_attendance`, `teacher_notes` hoặc assessment score.
- Lưu profile sẽ reset `last_content_hash` để lần sync kế tiếp parse lại toàn bộ Sheet.
- Không tự xóa dữ liệu nghiệp vụ đã có từ các version trước.

## Database

- Không thêm bảng/cột vật lý.
- Cần chạy `db/neon_upgrade_v0.25.0.sql` để tạo profile mặc định cho các nguồn hiện có, bật confirmation guard và reset content hash.
