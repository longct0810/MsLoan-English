# v0.24.3 - Google Sheets First Student Row Hotfix

- Sửa parser có thể nuốt học viên đầu tiên khi Google Sheet dùng header một dòng chứa đồng thời `STT`, `Họ và Tên`, ngày và tên trường dữ liệu.
- Parser tự phân biệt 3 layout header: một dòng; date row rồi field row; date row phía trên field row.
- Với single-row header, bỏ phần ngày khỏi tên field trước khi phân loại, ví dụ `07.09.2026 Điểm danh` -> `Điểm danh`.
- Regression xác nhận `Vũ Văn Đăng Khánh` ở dòng dữ liệu đầu tiên không còn bị bỏ qua, đồng thời không làm hỏng layout hai dòng đang dùng ở các lớp khác.
- Không cần migration DB từ v0.24.2.

