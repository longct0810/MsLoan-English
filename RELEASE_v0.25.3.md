# English Classroom v0.25.3

Hotfix cho chức năng ghi nhận thanh toán học phí.

## Fixed

- Nút **Xác nhận đã thu** không còn lỗi `inconsistent types deduced for parameter $2`.
- Khi thu đủ: invoice chuyển `PAID`, `paid_at` được ghi.
- Khi thu một phần: invoice chuyển `PARTIAL`, `paid_at` vẫn `NULL`.

## Database

Không có migration mới so với v0.25.2. Nếu nâng trực tiếp từ v0.25.0/v0.25.1, vẫn cần chạy migration `db/neon_upgrade_v0.25.2.sql`.
