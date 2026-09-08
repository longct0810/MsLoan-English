# Changelog

## v0.25.0 - Google Sheets Schema Profiles & Dry-run Validation

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


## v0.24.3 - Google Sheets First Student Row Hotfix

- Sửa parser có thể nuốt học viên đầu tiên khi Google Sheet dùng header một dòng chứa đồng thời `STT`, `Họ và Tên`, ngày và tên trường dữ liệu.
- Parser tự phân biệt 3 layout header: một dòng; date row rồi field row; date row phía trên field row.
- Với single-row header, bỏ phần ngày khỏi tên field trước khi phân loại, ví dụ `07.09.2026 Điểm danh` -> `Điểm danh`.
- Regression xác nhận `Vũ Văn Đăng Khánh` ở dòng dữ liệu đầu tiên không còn bị bỏ qua, đồng thời không làm hỏng layout hai dòng đang dùng ở các lớp khác.
- Không cần migration DB từ v0.24.2.

## v0.24.2 - Google Sheets Student Row Retention

- Không còn bỏ qua học viên chỉ vì dòng Google Sheet chưa có STT/điểm. Nếu cột Họ và Tên có giá trị hợp lệ, hệ thống luôn tạo `external_student_links` và thử auto-match.
- Nếu một dòng có dữ liệu nhưng ô Họ và Tên trống (thường do merge cell), parser tạo row staging `row:<n>` với trạng thái UNMATCHED thay vì âm thầm bỏ qua.
- Dòng thiếu tên không auto-match; giáo viên có thể mapping thủ công nếu xác định đúng học viên.
- Giữ nguyên manual mapping ở các lần sync sau.
- Không cần migration DB từ v0.24.1.

## v0.24.1 - Shared Parent Account Integrity

- Hỗ trợ an toàn một PARENT account liên kết nhiều học viên.
- Không rename/reset nhầm tài khoản phụ huynh dùng chung khi chỉnh sửa một học viên.
- Đồng bộ parent profile legacy cho tất cả anh/chị/em cùng tài khoản.
- UI đánh dấu tài khoản phụ huynh dùng chung và cảnh báo khi chỉnh sửa.
- Không cần migration DB từ v0.24.0.

## v0.24.0 - Username Authentication + Student Code + Tuition Transfer Code

- Đăng nhập bằng username thay email cho mọi role.
- Form Student/Parent account bỏ validate email, dùng username.
- Thêm student code `Y{6|7|8|9}_HS{id}`.
- Tuition transfer code dùng `HP YYYYMM {student_code}` và VietQR addInfo.
- Bắt buộc migration `db/neon_upgrade_v0.24.0.sql` khi nâng từ v0.23.1.

## v0.23.1 - Compact Navigation & Account Menu

- Chuyển thông tin đăng nhập, Đổi mật khẩu và Đăng xuất từ cuối sidebar lên menu tài khoản góc trên bên phải.
- Sidebar tự cuộn khi menu dài, tránh đẩy các mục điều hướng ra ngoài màn hình.
- Giữ CSRF cho Đăng xuất và không thay đổi database.

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

# v0.22.0 - Student Learning Profile & Skill Analytics

- Thêm Hồ sơ học tập giáo viên tại `/students/:id` với điểm, nguồn điểm, chuyên cần, kỹ năng, bài tập/test và nhận xét theo lớp/tháng.
- Danh sách Học viên có nút **Xem**.
- `/skills` chuyển nguồn chuẩn từ `student_skills` sang `student_skill_events`, class-scoped, có số lần đánh giá và xu hướng 2 lần gần nhất.
- Báo cáo giáo viên, Student Portal và Parent Report đọc skill analytics từ `student_skill_events`, nên dùng được dữ liệu Google Sheets (`source_type=EXTERNAL`).
- Chi tiết assessment Google Sheets cho phép giáo viên chỉnh `skill_code` hoặc chọn Không tính kỹ năng; lần sync kế tiếp tái materialize theo mapping mới.
- Giữ `student_skills` để backward compatibility nhưng UI chính không còn phụ thuộc bảng này.
- Thêm index analytics `idx_student_skill_events_student_class_skill_date`.

# v0.21.2 - Google Sheets DATE Boundary Hotfix

- Fix backend date-range validation when PostgreSQL `DATE` values are returned by `pg` as JavaScript `Date` objects.
- v0.21.1 used `String(date).slice(0,10)`, producing values such as `Thu Jan 01`; lexical comparison then incorrectly marked every ISO observation date as before `import_from_date`.
- Normalize `import_from_date` / `import_to_date` to `YYYY-MM-DD` before comparison.
- Keep future-date and explicit import range protections intact.
- No database migration required from v0.21.1.
- After deploy, use **Đồng bộ ngay** once to rewrite staging warnings and materialize eligible 2026 scores.

# v0.21.1 - Google Sheets Score Visibility & Progress Hotfix

## Fixed

- Đồng bộ điểm từ Google Sheets đã ghi `student_scores` nhưng trước đây không refresh `student_progress_summary`, khiến Dashboard/Class/Student UI vẫn có thể hiển thị điểm trung bình cũ (thường là 0).
- `Đồng bộ ngay` giờ luôn re-process dữ liệu dù Sheet không thay đổi. Scheduler định kỳ vẫn dùng SHA-256 để bỏ qua dữ liệu không đổi.
- Sau khi materialize điểm hoặc điểm danh, hệ thống refresh lại `average_score` và `attendance_rate` cho các học sinh bị tác động trong cùng transaction.
- Trang chi tiết assessment hiển thị rõ `Đã ghi điểm` và giá trị thực tế đã lưu trong `student_scores`.
- Thông báo sync hiển thị số bài test và số điểm đã ghi DB để dễ chẩn đoán.

## Database

Không cần migration từ v0.21.0. Sau deploy, bấm **Đồng bộ ngay** để backfill lại progress summary và xác nhận điểm.


---

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


## v0.20.2 - 2026-08-28
- Fix data-integrity risk caused by DEMO_MODE on deployed environments.
- Production now refuses to start when DEMO_MODE=true.
- Demo mode is visibly marked in the UI and `/health`.
- `.env.example` defaults to persistent PostgreSQL mode.

# v0.20.1

## Google Sheets mapping hotfix

- Mapping dropdown hiển thị toàn bộ học sinh ACTIVE thuộc phạm vi giáo viên, không chỉ học sinh có `class_students.class_id` đúng tuyệt đối với nguồn.
- Khi liên kết học sinh đang ở lớp khác của cùng giáo viên, hệ thống tự kích hoạt membership vào đúng lớp nguồn trong transaction rồi lưu mapping MANUAL.
- Sau mapping thủ công, gắn lại observation đã staging và reset hash để lần sync kế tiếp xử lý dữ liệu ngay cả khi Sheet chưa đổi.
- Sửa hiển thị ngày `import_from_date` bị thành `Thu Jan 01`.
- Không thay đổi database schema so với v0.20.0.

# v0.20.0

## Google Sheets Data Source

- Tích hợp Google Sheet theo dõi của giáo viên thành nguồn dữ liệu định kỳ cho PostgreSQL/Neon.
- Đồng bộ theo chu kỳ từng nguồn (mặc định 15 phút), SHA-256 bỏ qua lần không đổi và advisory lock chống chạy trùng trên PM2 cluster.
- Parser động cho cấu trúc nhóm ngày/cột, staging toàn bộ observation trước khi materialize.
- Auto-map học sinh theo tên chuẩn hóa duy nhất; hỗ trợ mapping thủ công.
- Materialize an toàn điểm, skill event, điểm danh và ghi chú; không ghi đè điểm danh nhập tay, không tự xóa dữ liệu nghiệp vụ.
- Thêm giao diện `/teacher/data-sources`, lịch sử sync và nút đồng bộ ngay.
- Migration: `db/neon_upgrade_v0.20.0.sql`.

# v0.19.1

## Assignment hotfix

- Fixed `/assignments/new` EJS crash caused by referencing an undefined `assignment` variable on the create form.
- Restored teacher-side display of submitted attachment metadata and rubric scores in assignment detail.
- Added explicit CSRF hidden fields to teacher assignment create/edit/publish/grade forms.
- No database schema changes are required from v0.19.0.

# Changelog

## v0.24.3 - Google Sheets First Student Row Hotfix

- Sửa parser có thể nuốt học viên đầu tiên khi Google Sheet dùng header một dòng chứa đồng thời `STT`, `Họ và Tên`, ngày và tên trường dữ liệu.
- Parser tự phân biệt 3 layout header: một dòng; date row rồi field row; date row phía trên field row.
- Với single-row header, bỏ phần ngày khỏi tên field trước khi phân loại, ví dụ `07.09.2026 Điểm danh` -> `Điểm danh`.
- Regression xác nhận `Vũ Văn Đăng Khánh` ở dòng dữ liệu đầu tiên không còn bị bỏ qua, đồng thời không làm hỏng layout hai dòng đang dùng ở các lớp khác.
- Không cần migration DB từ v0.24.2.

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

## v0.25.1
- Tuition Historical Attendance Hotfix.
