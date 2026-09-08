# v0.25.3 - Tuition Payment Confirmation Hotfix

- Sửa lỗi PostgreSQL `inconsistent types deduced for parameter $2` khi giáo viên bấm **Xác nhận đã thu**.
- Nguyên nhân: cùng bind parameter `$2` được PostgreSQL suy luận ở cả ngữ cảnh `status` (varchar) và phép so sánh với literal text trong `CASE`.
- `paid_at` giờ được tính ở Node.js và truyền bằng bind parameter riêng, loại bỏ suy luận kiểu mơ hồ.
- Giữ nguyên transaction, kiểm tra số tiền còn thiếu và trạng thái `UNPAID/PARTIAL`.
- Không cần migration DB từ v0.25.2.
