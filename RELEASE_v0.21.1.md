# English Classroom v0.21.1

Hotfix cho Google Sheets Assessment Mapping.

## Deploy từ v0.21.0

1. Backup source hiện tại.
2. Deploy source/patch v0.21.1.
3. Không cần chạy migration DB.
4. `npm ci` nếu deploy full source.
5. `pm2 restart all --update-env`.
6. Mở **Nguồn dữ liệu → Google Sheets → Đồng bộ ngay**.
7. Mở một assessment và kiểm tra Cao Gia Linh: trạng thái phải hiện **Đã ghi điểm** nếu không có cảnh báo ngày/thang điểm.

Nếu vẫn chưa ghi điểm, trang assessment sẽ hiển thị trực tiếp warning/staging reason thay vì chỉ báo chung.
