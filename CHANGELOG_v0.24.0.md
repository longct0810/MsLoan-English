# CHANGELOG v0.24.0

## Username Authentication + Student Code + Tuition Transfer Code

Baseline: v0.23.1.

### Authentication
- Chuyển đăng nhập của ADMIN/TEACHER/STUDENT/PARENT từ email sang `username`.
- Form đăng nhập dùng `username`; email không còn là định danh xác thực.
- Session chỉ lưu `id`, `fullName`, `username`, `role`.
- Giữ cột email nullable để tương thích dữ liệu cũ/liên hệ, nhưng không dùng để đăng nhập.

### Student / Parent accounts
- Form tạo/sửa học viên bỏ các trường email đăng nhập và validate email.
- Thay bằng `studentUsername` và `parentUsername`.
- Username được chuẩn hóa lowercase, dài 3–50 ký tự, cho phép `a-z`, `0-9`, `.`, `_`, `-`.
- Có thể dùng số điện thoại làm username phụ huynh.
- Parent account vẫn được tái sử dụng nếu username đã tồn tại với role `PARENT`.

### Student code
- Thêm `students.student_code`.
- Cấu trúc: `Y{grade}_HS{student_id}`, grade chỉ nhận 6/7/8/9.
- Ví dụ học viên id=9 ở lớp khối 6: `Y6_HS9`.
- Mã được sinh sau khi có `students.id` và giữ ổn định; đổi lớp sau này không tự đổi mã đã cấp.

### Tuition transfer content
- Thêm `tuition_invoices.transfer_code`.
- Nội dung chuyển khoản chuẩn: `HP YYYYMM {student_code}`.
- Ví dụ tháng 09/2026, học viên `Y6_HS9`: `HP 202609 Y6_HS9`.
- VietQR dùng `transfer_code` làm `addInfo`; fallback về `public_code` chỉ dành cho dữ liệu cũ chưa được backfill.

### Migration
- Bắt buộc chạy `db/neon_upgrade_v0.24.0.sql` trước khi deploy source.
- Migration tự tạo username từ local-part email cũ; nếu trùng sẽ thêm `_<user_id>`.
- Migration backfill student code dựa trên lớp ACTIVE thuộc grade 6/7/8/9.
- Migration backfill transfer code cho invoice cũ khi có student code.
