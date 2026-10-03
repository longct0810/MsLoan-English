# MsLoan-English v0.26.0

## Nâng cấp

1. Chạy `sql/upgrade_v0.26.0.sql` trên PostgreSQL/Neon.
2. Cài dependencies bằng `npm ci`.
3. Chạy kiểm thử bằng `npm test`.
4. Khởi động ứng dụng bằng `npm start`.

Migration tạo bảng liên kết Facebook/Messenger/Zalo theo giáo viên và tính lại điểm trung bình đã lưu theo quy tắc chỉ lấy điểm lớn hơn 0.

## Thay đổi

- Hỗ trợ nộp bài bằng văn bản, tệp, audio hoặc kết hợp; mở rộng định dạng tệp học tập được chấp nhận.
- Bài chưa làm hoặc nộp trễ được ưu tiên ở đầu danh sách cần theo dõi.
- Điểm `-1` hiển thị là “Quên phiếu bài”, `-2` là “Chưa hoàn thành”; cả hai và điểm 0 không tham gia trung bình.
- Giáo viên cấu hình liên kết mạng xã hội; phụ huynh thấy liên kết trong header.
- Tăng cỡ chữ cơ sở của giao diện thêm một nấc.
