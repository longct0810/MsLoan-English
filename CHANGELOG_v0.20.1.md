# v0.20.1

## Google Sheets mapping hotfix

- Sửa danh sách mapping chỉ hiển thị học sinh có membership ACTIVE đúng `source.class_id`.
- Mapping UI nay hiển thị toàn bộ học sinh ACTIVE thuộc phạm vi giáo viên, chia nhóm học sinh đang ở lớp nguồn và học sinh ở lớp khác.
- Khi giáo viên liên kết một học sinh ở lớp khác, hệ thống tự kích hoạt membership của học sinh vào đúng lớp nguồn trong cùng transaction rồi lưu mapping MANUAL.
- Giữ nguyên ownership: chỉ học sinh đang thuộc ít nhất một lớp do chính giáo viên quản lý mới có thể được chọn.
- Sau khi mapping thủ công, cập nhật `student_id` cho observation đã staging và reset content hash để lần sync kế tiếp materialize dữ liệu ngay cả khi Sheet chưa đổi.
- Sửa hiển thị `import_from_date` bị thành `Thu Jan 01` trên giao diện.
- Không thay đổi schema database; không cần migration từ v0.20.0.
