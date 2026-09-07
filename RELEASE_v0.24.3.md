# English Classroom v0.24.3

**Google Sheets First Student Row Hotfix**

Baseline: **v0.24.2**.

Sửa lỗi parser Google Sheets có thể dùng học viên đầu tiên làm `field header` khi sheet dùng layout header một dòng. Trường hợp đã xác nhận ở nguồn lớp 9: `Vũ Văn Đăng Khánh` nằm trước `Vũ Văn Đăng Khoa` trong CSV nhưng v0.24.2 chỉ tạo link cho Khoa.

Không cần migration database.
