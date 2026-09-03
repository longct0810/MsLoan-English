# Apply patch v0.23.0 từ v0.22.0

1. Backup source v0.22.0 và Neon.
2. Chạy `db/neon_upgrade_v0.23.0.sql`.
3. Ghi đè các file trong patch vào source v0.22.0.
4. Giữ nguyên `.env` production.
5. Chạy `npm ci`.
6. `pm2 restart all --update-env`.
7. Xác nhận giao diện hiển thị v0.23.0 và menu **Học phí & QR**.
