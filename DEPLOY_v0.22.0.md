# Deploy v0.22.0 từ v0.21.2

1. Backup/branch Neon.
2. Chạy `db/neon_upgrade_v0.22.0.sql`.
3. Deploy source v0.22.0 (giữ `.env` production).
4. `npm ci` rồi `pm2 restart all --update-env`.
5. Kiểm tra `/health` và version `0.22.0`.
6. Vào **Học viên → Xem** để kiểm tra điểm Google Sheets.
7. Vào **Theo dõi kỹ năng**; dữ liệu được tổng hợp từ `student_skill_events`.
8. Với assessment Google Sheets chưa nhận diện đúng kỹ năng: **Nguồn dữ liệu → bài test → Xem → Kỹ năng → Lưu**, sau đó bấm **Đồng bộ ngay**.
