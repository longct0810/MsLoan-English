# English Classroom v0.21.0

Google Sheets Assessment Mapping.

## Deploy từ v0.20.2
1. Backup/branch database Neon.
2. Chạy `db/neon_upgrade_v0.21.0.sql`.
3. Deploy source v0.21.0, giữ nguyên `.env` production.
4. `npm ci`.
5. Restart PM2 bằng `pm2 restart all --update-env`.
6. Vào `Nguồn dữ liệu` và bấm `Đồng bộ ngay` một lần.
7. Kiểm tra bảng `Bài kiểm tra / điểm nhận diện từ Google Sheets` và map Exam/Assignment nếu cần.

Không cần tạo lại nguồn Google Sheets và không cần tạo lại mapping học sinh.
