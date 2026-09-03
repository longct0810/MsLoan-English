# English Classroom v0.23.0

**Tuition Billing & QR Payment**

Baseline: v0.22.0.

## Deploy
1. Backup/branch Neon.
2. Chạy `db/neon_upgrade_v0.23.0.sql`.
3. Deploy source v0.23.0, giữ `.env` production hiện tại.
4. `npm ci`.
5. `pm2 restart all --update-env`.
6. Đăng nhập TEACHER → **Học phí & QR** → cấu hình tài khoản nhận tiền.
7. Kiểm tra đơn giá lớp, tạo kỳ học phí, rà soát và bấm **Gửi thông báo & tạo QR**.

Không cần thêm biến môi trường mới.
