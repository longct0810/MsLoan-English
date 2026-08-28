# English Classroom v0.20.0

Nâng cấp từ **v0.19.1**.

## Database

Trước khi deploy source, chạy trên Neon SQL Editor:

```text
db/neon_upgrade_v0.20.0.sql
```

Migration chỉ thêm bảng/cột/index phục vụ Google Sheets Data Source và mở rộng `student_skill_events.source_type` với `EXTERNAL`; không DROP/DELETE dữ liệu nghiệp vụ.

## Deploy

1. Tạo backup/branch Neon.
2. Chạy `db/neon_upgrade_v0.20.0.sql`.
3. Deploy source v0.20.0.
4. Build: `npm ci`.
5. Start: `npm start` (entrypoint `src/server.js`).
6. Kiểm tra `DEMO_MODE=false`.
7. Bổ sung các biến `GOOGLE_SHEET_*` trong `.env` nếu muốn thay đổi mặc định.
8. Đăng nhập TEACHER → `Nguồn dữ liệu` → chọn lớp → lưu Google Sheets URL → `Đồng bộ ngay`.

## Nguồn Google Sheet hiện tại

```text
https://docs.google.com/spreadsheets/d/1Pf4YrlHn-8JQIDCIjQR0Szumitn8Yt-v_QxAPF-JO_I/edit?gid=0#gid=0
```

Chu kỳ mặc định: **15 phút**. File hiện cần quyền Viewer công khai; bước hardening tiếp theo là Google Service Account read-only và chuyển file về Private.
