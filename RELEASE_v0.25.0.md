# English Classroom v0.25.0

**Google Sheets Schema Profiles & Dry-run Validation**

Baseline: **v0.24.3**.

Bản này xử lý nguyên nhân gốc khi nhiều Google Sheet của các lớp có layout khác nhau. Mỗi nguồn được cấu hình schema profile riêng và có Dry-run trước khi materialize dữ liệu.

## Quy trình sau deploy

1. Chạy `db/neon_upgrade_v0.25.0.sql`.
2. Deploy source v0.25.0 và restart PM2.
3. Vào từng nguồn trong **Nguồn dữ liệu** -> **Cấu hình & Dry-run**.
4. Kiểm tra số học viên, ô điểm danh, điểm số, ngày và các cảnh báo.
5. Nếu AUTO nhận sai, chỉnh mode/header hoặc override từng cột.
6. Tick **Xác nhận cấu trúc để cho phép ghi DB** và lưu.
7. Quay lại nguồn -> **Đồng bộ ngay**.

Nguồn chưa xác nhận chỉ staging, không ghi dữ liệu nghiệp vụ.
