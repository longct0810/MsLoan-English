# MsLoan-English v0.26.2

## Nâng cấp

1. Không cần migration database.
2. Máy chủ cần cài FFmpeg và gọi được bằng lệnh `ffmpeg`; có thể cấu hình `FFMPEG_PATH` nếu binary không nằm trong PATH.
3. Với triển khai Docker, dùng Dockerfile trong repo để cài FFmpeg cùng ứng dụng.
4. Cài dependencies bằng `npm ci`, chạy kiểm thử bằng `npm test`, khởi động bằng `npm start`.

## Thay đổi v0.26.2

- Video học viên tải lên được chuyển sang MP4 H.264, CRF 22, preset medium, giữ nguyên độ phân giải và âm thanh AAC 128 kbps.
- Nếu bản nén không nhỏ hơn tệp gốc, ứng dụng giữ nguyên file gốc.
- Chỉ video được nén; tài liệu, ảnh và audio vẫn giữ nguyên.
- Tệp video vẫn lưu trong PostgreSQL như trước; không đổi schema.

## Thay đổi kế thừa từ v0.26.1

- API public nhẹ dành riêng cho cron/keep-alive: `GET /api/cron/ping`.
- Endpoint không truy vấn database và được mount trước session middleware.

## Nội dung kế thừa từ v0.26.0

- Hỗ trợ nộp bài bằng văn bản, tệp, audio hoặc kết hợp.
- Bài chưa làm hoặc nộp trễ được ưu tiên ở đầu danh sách cần theo dõi.
- Điểm `-1` hiển thị là “Quên phiếu bài”, `-2` là “Chưa hoàn thành”; điểm trung bình chỉ tính điểm lớn hơn 0.
- Giáo viên cấu hình liên kết mạng xã hội; phụ huynh thấy liên kết trong header.
- Tăng cỡ chữ cơ sở của giao diện thêm một nấc.
