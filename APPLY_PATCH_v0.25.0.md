# Apply patch v0.24.3 -> v0.25.0

1. Backup source v0.24.3 và `.env`.
2. Chép đè toàn bộ file trong patch vào root project.
3. Chạy `db/neon_upgrade_v0.25.0.sql` trên Neon.
4. `npm ci`.
5. `pm2 restart all --update-env && pm2 save`.
6. Với từng Google Sheet, vào **Cấu hình & Dry-run**, kiểm tra và xác nhận profile trước khi đồng bộ.
