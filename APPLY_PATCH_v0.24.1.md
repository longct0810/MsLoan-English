# Apply patch v0.24.1 từ v0.24.0

1. Backup source v0.24.0 hiện tại.
2. Ghi đè các file trong patch vào đúng thư mục ứng dụng.
3. Không cần chạy migration database.
4. Chạy `npm ci` nếu node_modules chưa đầy đủ.
5. Restart: `pm2 restart all --update-env`.
6. Hard refresh trình duyệt.
7. Kiểm tra `/students`: tài khoản phụ huynh dùng chung sẽ có badge số học viên.
