# v0.19.1

## Assignment hotfix

- Fixed `/assignments/new` EJS crash caused by referencing an undefined `assignment` variable on the create form.
- Restored teacher-side display of submitted attachment metadata and rubric scores in assignment detail.
- Added explicit CSRF hidden fields to teacher assignment create/edit/publish/grade forms.
- No database schema changes are required from v0.19.0.

# Changelog

## v0.19.0
- Exam 2.0 với Question Pool, rule theo skill/difficulty/question type.
- Random thứ tự câu hỏi và đáp án.
- Pass score, student override cho thời gian/số lần làm/reopen.
- Immutable `exam_question_snapshots` khi publish.
- Lưu thứ tự câu/đáp án theo từng attempt.
- Migration `db/neon_upgrade_v0.19.0.sql`.


## v0.18.0
- Assignment 2.0: TEXT/FILE/AUDIO/MIXED submission.
- Upload tối đa 3 tệp, hỗ trợ audio Speaking, PDF, ảnh, Word; tệp được bảo vệ theo ownership.
- Rubric chấm theo các skill đã gắn; đồng bộ Skill Tracking.
- Migration `db/neon_upgrade_v0.18.0.sql`.


## v0.17.0
- Skill Tracking chuẩn hóa 7 kỹ năng tiếng Anh.
- Gắn kỹ năng cho Question và Assignment.
- Tự tạo skill event khi chấm Assignment/Exam.
- Dashboard `/skills` theo lớp/học viên; duy trì tương thích với `student_skills`.
- Migration `db/neon_upgrade_v0.17.0.sql`.


## v0.16.0
- Sổ đầu bài điện tử cho từng buổi học.
- Lưu mục tiêu, nội dung thực dạy, homework, ghi chú nội bộ, tóm tắt phụ huynh và kế hoạch buổi sau.
- Sao chép nội dung từ buổi trước.
- Ghi thời điểm/người hoàn thành buổi học.
- Migration Neon riêng `db/neon_upgrade_v0.16.0.sql`.


## v0.15.0 - Teacher Report Center

### Teacher Reports
- Kích hoạt menu `Báo cáo` cho TEACHER/ADMIN tại `/reports`.
- Bộ lọc theo tháng và lớp, giữ toàn bộ dữ liệu trong phạm vi class ownership của actor.
- KPI: học viên, điểm trung bình quy đổi thang 10, chuyên cần, tỷ lệ nộp bài và số bài/bài thi đang chờ chấm.
- Bảng tổng quan theo lớp: sĩ số, điểm, chuyên cần, nộp bài, chờ chấm và số học viên cần chú ý.
- Danh sách học viên cần chú ý dựa trên điểm dưới 7, chuyên cần dưới 90% và bài quá hạn; có mức ưu tiên cao/trung bình.
- Báo cáo chi tiết từng học viên: điểm số, bài tập, bài kiểm tra, chuyên cần, kỹ năng hiện có và nhận xét giáo viên gắn với buổi học.
- Xuất báo cáo CSV, Excel `.xlsx` và In / lưu PDF từ trình duyệt.

### Data Integrity & Authorization
- Thêm `student_scores.class_id` để score có thể được scope an toàn theo lớp/giáo viên.
- Backfill score từ Assignment/Exam; score legacy chỉ được tự gắn class khi học viên có đúng một lớp active.
- Assignment/Exam grading mới luôn ghi `class_id` vào `student_scores`.
- Teacher Report không đọc score của class ngoài ownership; student detail cũng kiểm tra ownership.
- Dữ liệu skill trong report chi tiết bị ẩn khi học viên đồng thời thuộc class active của giáo viên khác, tránh lộ dữ liệu tổng hợp chưa có class scope.

### Database
- Thêm migration `db/neon_upgrade_v0.15.0.sql`.
- Thêm index `idx_student_scores_class_recorded` và `idx_exam_attempts_student_submitted`.

### Quality
- Thêm test report ownership, class filter authorization, student detail authorization và KPI/attention.
- Tổng bộ test tăng từ 25 lên 30 test.

## v0.14.1 - Account Password Management

### Account Security
- Thêm trang đổi mật khẩu dùng chung cho ADMIN, TEACHER, STUDENT và PARENT tại `/account/password`.
- Yêu cầu xác minh mật khẩu hiện tại trước khi đổi.
- Mật khẩu mới tối thiểu 8 ký tự, tối đa 128 ký tự, phải khớp xác nhận và khác mật khẩu hiện tại.
- Hash mật khẩu mới bằng bcrypt theo `BCRYPT_ROUNDS`; không lưu hoặc ghi log mật khẩu thuần.
- Regenerate session sau khi đổi mật khẩu để xoay session id hiện tại.
- Hỗ trợ cả PostgreSQL/Neon và Demo Mode.
- Thêm liên kết `Đổi mật khẩu` trên desktop sidebar và menu mobile cho tất cả vai trò.
- Bổ sung CSRF token trực tiếp cho form đăng nhập, đổi mật khẩu và đăng xuất.

### Quality
- Thêm test cho mật khẩu hiện tại sai, mật khẩu mới không hợp lệ và đăng nhập bằng mật khẩu mới sau khi đổi.
- Tổng bộ test tăng từ 22 lên 25 test.
- Không cần migration database cho v0.14.1.

## v0.14.0 - Security & Data Integrity Hardening

### Authorization
- Scope Student list/detail/create/update/delete theo class owner; teacher không thể gán học viên vào class ngoài phạm vi.
- Khi học viên thuộc nhiều giáo viên, thao tác xóa của teacher chỉ gỡ khỏi các class mình quản lý; không xóa dữ liệu dùng chung.
- Scope Session, attendance, session notes và complete session theo owner của class.
- Scope Dashboard theo actor để tránh lộ KPI và dữ liệu teacher khác.
- Exam update kiểm tra class đích.
- Question create/update/import kiểm tra lesson/question ownership; bulk UPDATE được enforce cả ở repository SQL.

### Data Integrity
- Assignment bắt buộc lesson thuộc đúng class.
- Mở rộng score precision từ `NUMERIC(4,2)` lên `NUMERIC(8,2)` cho submission và student score.
- Thêm index hỗ trợ ownership lookup.

### Security
- Question import multipart bắt buộc CSRF token sau Multer.

### Quality
- Bổ sung test hardening cho Student, Session, Dashboard, Assignment, Exam, Question ownership, multipart CSRF và schema migration.

## v0.13.3 - Safe 403 Error Page

### Operations
- Sửa lỗi `appName is not defined` khi middleware CSRF hoặc same-origin render trang 403 trước view middleware.
- Trang 403 có fallback config độc lập, tương tự trang 500.

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
