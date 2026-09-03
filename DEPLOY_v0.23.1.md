# Deploy v0.23.1

Baseline: v0.23.0.

1. Backup source đang chạy.
2. Không cần chạy SQL migration.
3. Deploy source/patch v0.23.1, giữ nguyên `.env` production.
4. Chạy `npm ci` nếu deploy full source.
5. Restart: `pm2 restart all --update-env`.
6. Hard refresh trình duyệt (`Ctrl+Shift+R`).
7. Xác nhận version hiển thị là `v0.23.1` và menu tài khoản nằm ở góc trên bên phải.
