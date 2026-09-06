# Apply patch v0.23.1 -> v0.24.0

1. Backup source v0.23.1 và database.
2. **Chạy `db/neon_upgrade_v0.24.0.sql` trước.**
3. Chép nội dung patch đè lên source v0.23.1, giữ nguyên `.env`.
4. Nếu `.env` có `APP_VERSION=0.23.1`, đổi thành `0.24.0` hoặc xóa biến `APP_VERSION`.
5. Chạy:

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

6. Đăng nhập bằng username đã được migration tạo ra.
7. Test tạo/sửa học viên và tạo QR học phí.

Không rollback code về v0.23.1 trong khi database/user workflow đã chuyển sang username nếu chưa đánh giá dữ liệu phát sinh sau migration.
