# MsLoan-English v0.26.1

## Nâng cấp

1. Không có thay đổi schema/database so với v0.26.0.
2. Cài dependencies bằng `npm ci`.
3. Chạy kiểm thử bằng `npm test`.
4. Khởi động ứng dụng bằng `npm start`.

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
  "version": "0.26.1",
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
