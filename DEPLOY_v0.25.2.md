# Deploy v0.25.2

1. Backup/branch Neon.
2. Chạy `db/neon_upgrade_v0.25.2.sql`.
3. Deploy source v0.25.2.
4. `npm ci`
5. `pm2 restart all --update-env`
6. Mở kỳ học phí DRAFT và kiểm tra nội dung CK dạng `MMYYYY{student_code}`.

Ví dụ: `092026Y6_HS9`.
