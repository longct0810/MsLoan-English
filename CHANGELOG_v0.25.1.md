# v0.25.1 - Tuition Historical Attendance Hotfix

- Sửa lỗi tạo học phí theo tháng chỉ sinh hóa đơn cho học viên có `class_students.joined_at` nằm trước/cuối kỳ.
- Với `PER_SESSION`, danh sách học viên lập hóa đơn giờ lấy trực tiếp từ `session_attendance` + `class_sessions` trong kỳ.
- Dữ liệu điểm danh lịch sử từ Google Sheets vẫn được tính học phí dù membership lớp được tạo/mapping sau đó.
- Không thay đổi schema database.
