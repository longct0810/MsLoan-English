# MsLoan-English v0.26.3

## Nâng cấp

1. Không cần migration database.
2. Máy chủ cần có FFmpeg trên `PATH`; có thể đặt `FFMPEG_PATH` nếu binary nằm ở vị trí khác. Khi triển khai bằng Docker, Dockerfile trong repo cài FFmpeg sẵn. Với Render, chạy service bằng Docker runtime.
3. Cài dependencies bằng `npm ci`.
4. Chạy kiểm thử bằng `npm test`.
5. Khởi động ứng dụng bằng `npm start`.

## Thay đổi v0.26.3

- Đồng bộ tất cả nguồn Google Sheets đang bật vào 11:00 và 23:00 mỗi ngày theo APP_TIMEZONE (mặc định Asia/Ho_Chi_Minh).
- Có thể cấu hình giờ chạy qua GOOGLE_SHEET_SYNC_TIMES, ví dụ `10:30,22:30`. Nguồn bị tắt sẽ được bỏ qua.
- Không cần migration database.

## Thay đổi v0.26.2

- Nén video học viên tải lên thành MP4 H.264, CRF 22, preset medium; giữ nguyên độ phân giải và mã hóa âm thanh AAC 128 kbps.
- Nếu bản nén không nhỏ hơn file gốc, hệ thống giữ nguyên file gốc. Tài liệu, ảnh và audio không bị xử lý.
- File tiếp tục lưu trong PostgreSQL; không đổi schema.

## Thay đổi v0.26.1

- Thêm API public nhẹ dành riêng cho cron/keep-alive: `GET /api/cron/ping`.
- API không truy vấn database và được mount trước session middleware để tránh tạo/load PostgreSQL session khi cron gọi định kỳ.
- Response trả về trạng thái, version, thời gian server và uptime của Node.js.
- Giữ nguyên các API health hiện có: `GET /health` và `GET /health/db`.

### Ví dụ gọi API

```bash
curl -fsS https://TEN-APP.onrender.com/api/cron/ping
```

Response mẫu:

```json
{
  "status": "ok",
  "service": "cron-keepalive",
  "app": "MsLoan English",
  "version": "0.26.2",
  "timestamp": "2026-10-05T00:45:00.000Z",
  "uptimeSeconds": 125
}
```

Nên để tool cron bên ngoài Render gọi endpoint này khoảng 10 phút/lần.

## Nội dung kế thừa từ v0.26.0

- Hỗ trợ nộp bài bằng văn bản, tệp, audio hoặc kết hợp; mở rộng định dạng tệp học tập được chấp nhận.
- Bài chưa làm hoặc nộp trễ được ưu tiên ở đầu danh sách cần theo dõi.
- Điểm `-1` hiển thị là “Quên phiếu bài”, `-2` là “Chưa hoàn thành”; cả hai và điểm 0 không tham gia trung bình.
- Giáo viên cấu hình liên kết mạng xã hội; phụ huynh thấy liên kết trong header.
- Tăng cỡ chữ cơ sở của giao diện thêm một nấc.
