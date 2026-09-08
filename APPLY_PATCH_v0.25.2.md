# Apply patch v0.25.2

Baseline: v0.25.1.

- Copy patch đè vào source.
- Chạy `db/neon_upgrade_v0.25.2.sql`.
- `npm ci`
- `pm2 restart all --update-env`

Không cần xóa/recreate kỳ học phí DRAFT; migration sẽ cập nhật transfer_code an toàn.
