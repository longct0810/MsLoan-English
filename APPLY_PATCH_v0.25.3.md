# Apply patch v0.25.3

Patch này được tạo trên baseline **v0.25.2**.

- Không cần migration mới.
- Ghi đè các file trong patch vào source v0.25.2.
- Chạy `npm ci` nếu cần, sau đó `pm2 restart all --update-env`.
- Nếu đang ở v0.25.0/v0.25.1, dùng full source v0.25.3 hoặc nâng tuần tự trước.
