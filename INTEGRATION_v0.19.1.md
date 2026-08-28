# Ghi nhận merge v0.19.1 -> v0.20.0

Bản source này **đã tích hợp hoàn chỉnh** patch Google Sheets vào baseline v0.19.1.

Các điểm đã merge:

- `src/modules/data-sources/` được mount tại `/teacher/data-sources`.
- Route được bảo vệ bằng session auth + `TEACHER` role; CSRF/same-origin dùng middleware global của v0.19.1.
- Scheduler được start từ `src/server.js` và dừng khi SIGTERM/SIGINT.
- View nằm đúng dưới `src/views/teacher/data-sources/` và dùng layout chung.
- Menu desktop/mobile có mục **Nguồn dữ liệu** cho TEACHER.
- Version `package.json`, `package-lock.json`, `VERSION` = `0.20.0`.
- Migration chuẩn nằm tại `db/neon_upgrade_v0.20.0.sql`; cumulative `db/schema.sql` cũng đã cập nhật cho fresh install.
- `.env.example` có các biến `GOOGLE_SHEET_*`.

Production cần chạy `db/neon_upgrade_v0.20.0.sql` trước khi restart application.
