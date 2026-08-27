# Changelog

## v0.13.2 - Render Error Handling

### Operations
- Sửa trang lỗi 500 để không phát sinh lỗi `appName is not defined` khi lỗi xảy ra trước middleware view data.
- Truyền fallback application config trực tiếp khi render error page.
- Hiển thị nút quay về `/home` an toàn cho cả phiên đăng nhập và chưa đăng nhập.

## v0.13.1 - Responsive Report Filter

### UI
- Sửa layout bộ lọc báo cáo phụ huynh trên mobile/tablet.
- Ngăn nút `Xem báo cáo` và `In / PDF` bị bẻ chữ theo chiều dọc.
- Chuyển nhóm control sang CSS Grid trên màn hình nhỏ.

## v0.13.0 - Notification Read Workflow

### Parent Portal
- Thêm thao tác đánh dấu tất cả thông báo là đã đọc.
- Giữ trạng thái đọc riêng theo từng tài khoản phụ huynh.
- Bổ sung test cho bulk read flow.

## v0.12.0 - Readable Parent Notifications

### Parent Portal
- Lưu trạng thái đã đọc của thông báo theo từng tài khoản phụ huynh.
- Thêm số lượng thông báo chưa đọc và trạng thái hiển thị đã đọc.
- Thêm thao tác đánh dấu thông báo đã đọc có bảo vệ CSRF.

### Database
- Thêm bảng `parent_notification_reads` và index theo phụ huynh.
- Thêm migration `db/neon_upgrade_v0.12.0.sql`.

### Quality
- Thêm test cho vòng đời unread/read và validation notification key.

## v0.11.0 - Parent Notifications

### Parent Portal
- Thêm trung tâm thông báo tại `/parent/notifications`.
- Sinh thông báo cho điểm mới, nhận xét, bài sắp hạn, bài nộp trễ và chuyên cần bất thường.
- Giới hạn dữ liệu theo quan hệ `parent_students`.
- Thêm test quyền truy cập và dữ liệu thông báo phụ huynh.

## v0.10.0 - Parent Report Export

### Parent Portal
- Thêm nút in báo cáo và lưu PDF bằng print stylesheet của trình duyệt.
- Ẩn sidebar, navbar và bộ lọc khi in để báo cáo phù hợp khổ giấy.
- Bổ sung thông tin lớp học trong báo cáo PostgreSQL.

## v0.9.0 - Parent Reports

### Parent Portal
- Thêm báo cáo học tập theo tháng tại `/parent/reports`.
- Thêm KPI điểm, chuyên cần, bài tập và kỹ năng cần ưu tiên.
- Thêm xu hướng điểm, bảng bài tập, chuyên cần và nhận xét giáo viên.
- Hỗ trợ lọc tháng và chọn nhiều người con.
- Thêm xuất CSV báo cáo qua `/parent/reports.csv`.

### Quality
- Thêm test cho monthly report và parent-child authorization.

## v0.8.0 - Security & Navigation

### Security
- Thêm CSRF token theo session cho form và API request.
- Chặn request thay đổi dữ liệu từ origin/referer khác với host ứng dụng.
- Regenerate và save session sau khi đăng nhập.
- Scope danh sách, detail, update và soft-delete lớp theo giáo viên; ADMIN được xem toàn bộ.
- Scope lessons, assignments và exams theo class owner; question bank theo `created_by` hoặc lesson owner.
- Exam question picker chỉ hiển thị và chấp nhận câu hỏi thuộc phạm vi của actor.

### UI & Quality
- Nhóm navigation theo `Lớp học` và `Nội dung & đánh giá`.
- Hiển thị trạng thái active rõ ràng hơn trên mobile offcanvas.
- Thêm test script nền tảng bằng Node test runner.

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
