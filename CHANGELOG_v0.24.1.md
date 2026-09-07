# v0.24.1 - Shared Parent Account Integrity

## Fixed

- Một tài khoản `PARENT` có thể liên kết nhiều học viên qua `parent_students` mà không tạo tài khoản phụ huynh trùng.
- Khi thêm học viên mới với `parentUsername` đã tồn tại, hệ thống tái sử dụng cùng tài khoản phụ huynh.
- Khi chỉnh sửa một học viên có phụ huynh đang dùng chung cho anh/chị/em khác, đổi sang username phụ huynh mới **không còn rename tài khoản dùng chung**. Hệ thống yêu cầu mật khẩu và tạo tài khoản PARENT mới chỉ cho học viên đang chỉnh sửa.
- Khi cập nhật họ tên/số điện thoại của một tài khoản phụ huynh dùng chung, dữ liệu legacy `students.parent_name/parent_phone` được đồng bộ cho tất cả học viên đang liên kết.
- Không reset mật khẩu của một PARENT account đã tồn tại khi chỉ liên kết thêm học viên vào tài khoản đó.
- Danh sách Học viên hiển thị badge `Tài khoản chung · N học viên`.
- Form chỉnh sửa cảnh báo rõ ảnh hưởng của việc đổi thông tin/mật khẩu tài khoản phụ huynh dùng chung.

## Parent Portal / Tuition / Google Sheets

- Parent Portal vốn đã hỗ trợ một phụ huynh chọn nhiều con; v0.24.1 giữ nguyên và có regression test.
- Tuition Portal truy vấn hóa đơn theo `parent_students`, do đó một phụ huynh xem được học phí riêng của từng con.
- Google Sheets mapping/sync tiếp tục theo `student_id`; không gộp dữ liệu học tập của hai anh/chị/em chỉ vì dùng chung `parent_user_id`.

## Database

Không cần migration schema từ v0.24.0.
