> Phiên bản hiện tại: **v0.23.0** – Tuition Billing & QR Payment.

# English Classroom v0.23.0

Bản này bổ sung tính học phí từ điểm danh (bao gồm dữ liệu Google Sheets), thông báo học phí cho phụ huynh và QR chuyển khoản.

## Đơn giá mặc định
- Lớp 5 lên 6 / khối 6: **150.000đ/buổi**.
- Lớp 7, 8, 9: **220.000đ/buổi**.

## Luồng dữ liệu
`Google Sheets → session_attendance → Tuition Cycle → Invoice Snapshot → Parent Portal → VietQR`.

## Nâng cấp
Chạy `db/neon_upgrade_v0.23.0.sql`, sau đó deploy source và restart PM2.

Xem `RELEASE_v0.23.0.md` để biết chi tiết.
