> Phiên bản hiện tại: **v0.24.1** – Shared Parent Account Integrity.

# English Classroom v0.24.1

Ứng dụng quản lý lớp học tiếng Anh cho giáo viên, học sinh và phụ huynh.

## Điểm mới v0.24.1

- Một tài khoản `PARENT` dùng an toàn cho nhiều học viên qua `parent_students`.
- Thêm học viên mới với `parentUsername` đã tồn tại sẽ tái sử dụng đúng tài khoản phụ huynh, không tạo duplicate.
- Khi chỉnh sửa một học viên, hệ thống không rename nhầm tài khoản phụ huynh đang dùng chung cho anh/chị/em khác.
- Đồng bộ họ tên/số điện thoại phụ huynh về các cột legacy của tất cả học viên đang liên kết.
- Danh sách/form học viên hiển thị rõ khi tài khoản phụ huynh đang được dùng chung.
- Parent Portal, Tuition và Google Sheets tiếp tục scope dữ liệu theo từng `student_id`, không gộp dữ liệu học tập của các anh/chị/em.

## Kế thừa từ v0.24.0

- Đăng nhập bằng username thay email cho mọi vai trò.
- Student code: `Y{grade}_HS{student_id}`.
- Tuition transfer code: `HP YYYYMM {student_code}`.

## Nâng từ v0.24.0

Không cần migration schema. Deploy source và restart PM2.

Xem `DEPLOY_v0.24.1.md` và `RELEASE_v0.24.1.md`.
