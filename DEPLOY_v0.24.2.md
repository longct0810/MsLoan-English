# Deploy v0.24.2 từ v0.24.1

1. Backup source hiện tại.
2. Deploy source/patch v0.24.2.
3. Không chạy migration DB.
4. Chạy `npm ci` nếu deploy full source hoặc dependency thay đổi.
5. `pm2 restart all --update-env` và `pm2 save`.
6. Vào **Nguồn dữ liệu → Lớp 9 → Đồng bộ ngay**.
7. Kiểm tra `external_student_links` cho Vũ Văn Đăng Khoa/Vũ Văn Đăng Khánh.

Kết quả kỳ vọng:
- Nếu Sheet có tên Khánh: tạo `name:vu van dang khanh` và auto-match Y9_HS43.
- Nếu dòng Khánh có dữ liệu nhưng ô tên trống do merge: xuất hiện `Dòng N (chưa có Họ và Tên)` ở mục mapping; liên kết thủ công với Y9_HS43 rồi Đồng bộ ngay lần nữa.
