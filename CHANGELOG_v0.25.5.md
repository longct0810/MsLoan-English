# English Classroom v0.25.5

## Google Sheets Sync Interval

- Thay tần suất **đồng bộ tự động** Google Sheets từ chu kỳ ngắn trước đây thành **3 ngày/lần**.
- Giá trị chuẩn: **4320 phút**.
- Các nguồn Google Sheets đang tồn tại được cập nhật sang 4320 phút bằng migration.
- Nguồn Google Sheets tạo mới cũng mặc định 4320 phút.
- Có DB trigger bảo vệ để bản app cũ gửi giá trị 15 phút cũng được chuẩn hóa thành 4320 phút.
- Nút **Đồng bộ ngay** vẫn hoạt động bình thường và không phải chờ 3 ngày.
- Không thay đổi heartbeat/polling loop của scheduler; scheduler vẫn có thể kiểm tra thường xuyên nhưng chỉ chạy nguồn đã đến hạn.

## Version

- `0.25.4` -> `0.25.5`
