# Changelog

## v0.7.0 - Student & Class Management

### Học viên
- Thêm mới học viên trực tiếp từ Teacher Portal.
- Chỉnh sửa hồ sơ học viên: họ tên, ngày sinh, trường, lớp tại trường, điện thoại.
- Gán một học viên vào một hoặc nhiều lớp.
- Khi tạo học viên mới, hệ thống tạo đồng thời tài khoản `STUDENT`.
- Đồng thời tạo hoặc tái sử dụng tài khoản `PARENT` theo email phụ huynh và liên kết qua `parent_students`.
- Quản lý họ tên, số điện thoại, email và quan hệ của phụ huynh.
- Đổi email/mật khẩu học viên và phụ huynh khi chỉnh sửa.
- Hỗ trợ các học viên cũ chưa có tài khoản: khi chỉnh sửa và nhập mật khẩu, hệ thống tạo tài khoản STUDENT tương ứng.
- Xóa học viên theo cơ chế soft-delete: khóa tài khoản và gỡ khỏi lớp nhưng giữ điểm, bài làm, chuyên cần và lịch sử.
- Nếu phụ huynh không còn học viên hoạt động nào, tài khoản phụ huynh được khóa; nếu còn con khác thì vẫn hoạt động.

### Lớp học
- Thêm mới lớp khối 6/7/8/9.
- Chỉnh sửa tên lớp, khối, năm học, lịch học và trạng thái.
- Xóa lớp theo cơ chế soft-delete, giữ nguyên dữ liệu học tập lịch sử.
- Từ chi tiết lớp có thể thêm học viên mới với lớp hiện tại được chọn sẵn.

### Database
- `users.phone`.
- `students.updated_at`, `students.deleted_at`.
- `classes.updated_at`, `classes.deleted_at`.
- Index cho bản ghi đang hoạt động và tra cứu tài khoản.

### Version
- Nâng version ứng dụng lên `0.7.0` và tiếp tục hiển thị tự động trên giao diện từ `package.json`.
