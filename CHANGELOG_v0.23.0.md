# v0.23.0 - Tuition Billing & QR Payment

- Tạo module `/teacher/tuition` để cấu hình đơn giá theo lớp, tài khoản nhận tiền và tạo kỳ học phí theo tháng.
- Học phí theo buổi được tính từ `session_attendance`; dữ liệu điểm danh từ Google Sheets tham gia trực tiếp sau khi đã materialize.
- Mặc định: khối 6 (lớp 5 lên 6) **150.000đ/buổi**; khối 7/8/9 **220.000đ/buổi**.
- Mặc định chỉ tính `PRESENT`, `LATE`, `ONLINE`; giáo viên có thể chỉnh trạng thái được tính phí theo lớp.
- Tạo snapshot điểm danh + đơn giá khi lập kỳ, tránh hóa đơn cũ tự thay đổi nếu nguồn Google Sheet thay đổi sau đó.
- Cho phép điều chỉnh giảm học phí/phụ thu trước khi gửi.
- Khi gửi kỳ học phí, hệ thống snapshot tài khoản ngân hàng và tạo VietQR riêng theo số tiền còn thiếu + mã chuyển khoản duy nhất.
- Parent Portal có `/parent/tuition`, chi tiết QR, trạng thái đã/chưa thanh toán và thông báo học phí.
- Giáo viên ghi nhận thanh toán thủ công, hỗ trợ thanh toán một phần.
- Tất cả truy vấn học phí được scope theo `teacher_id` hoặc `parent_students`.

## Database

Chạy `db/neon_upgrade_v0.23.0.sql` khi nâng từ v0.22.0.
