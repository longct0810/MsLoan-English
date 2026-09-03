# v0.23.1 - Compact Navigation & Account Menu

## UI / Navigation
- Chuyển khối thông tin tài khoản khỏi cuối sidebar lên menu tài khoản ở góc trên bên phải navbar.
- Menu tài khoản hiển thị tên người dùng, vai trò, version, Đổi mật khẩu và Đăng xuất.
- Giữ POST + CSRF cho thao tác Đăng xuất.
- Bỏ phần Đổi mật khẩu/Đăng xuất trùng lặp khỏi mobile offcanvas vì navbar luôn hiển thị menu tài khoản.
- Sidebar dành toàn bộ chiều cao còn lại cho điều hướng và tự cuộn khi số menu vượt chiều cao màn hình.

## Database
- Không thay đổi schema, không cần migration từ v0.23.0.
