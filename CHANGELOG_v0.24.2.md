# v0.24.2 - Google Sheets Student Row Retention

- Không còn bỏ qua học viên chỉ vì dòng Google Sheet chưa có STT/điểm. Nếu cột Họ và Tên có giá trị hợp lệ, hệ thống luôn tạo `external_student_links` và thử auto-match.
- Nếu một dòng có dữ liệu nhưng ô Họ và Tên trống (thường do merge cell), parser tạo row staging `row:<n>` với trạng thái UNMATCHED thay vì âm thầm bỏ qua.
- Dòng thiếu tên không auto-match; giáo viên có thể mapping thủ công nếu xác định đúng học viên.
- Giữ nguyên manual mapping ở các lần sync sau.
- Không cần migration DB từ v0.24.1.

