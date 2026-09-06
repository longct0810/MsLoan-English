> Phiên bản hiện tại: **v0.24.0** – Username Authentication + Student Code + Tuition Transfer Code.

# English Classroom v0.24.0

Ứng dụng quản lý lớp học tiếng Anh cho giáo viên, học sinh và phụ huynh.

## Điểm mới v0.24.0

- Đăng nhập bằng **tên tài khoản** thay cho email cho mọi vai trò.
- Tạo/sửa học viên dùng username học viên/phụ huynh, không validate email đăng nhập.
- Mã học sinh ổn định: `Y{grade}_HS{student_id}` với grade 6/7/8/9.
- Nội dung chuyển khoản học phí: `HP YYYYMM {student_code}` và được đưa vào VietQR.

## Nâng từ v0.23.1

Chạy `db/neon_upgrade_v0.24.0.sql` **trước khi deploy source**, sau đó `npm ci` và restart PM2.

Xem `DEPLOY_v0.24.0.md` và `RELEASE_v0.24.0.md`.
