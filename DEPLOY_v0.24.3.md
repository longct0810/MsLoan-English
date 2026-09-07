# Deploy v0.24.3

Baseline: v0.24.2.

1. Backup source hiện tại.
2. Apply patch hoặc deploy full source v0.24.3.
3. Không cần chạy migration DB.
4. Chạy `npm ci` nếu deploy full source hoặc dependency tree đã thay đổi.
5. Restart: `pm2 restart all --update-env && pm2 save`.
6. Xác nhận UI/version là `v0.24.3`.
7. Vào **Nguồn dữ liệu -> Lớp 9 -> Đồng bộ ngay**.
8. Kiểm tra `external_student_links`: phải xuất hiện riêng `Vũ Văn Đăng Khánh` và `Vũ Văn Đăng Khoa` nếu cả hai có tên trong CSV.

Nếu trước đó đã reset mapping Khoa/Khánh thì không cần reset thêm; manual sync sẽ re-process source.
