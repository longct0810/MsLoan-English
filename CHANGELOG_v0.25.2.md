# v0.25.2 - Tuition Transfer Content Format

- Đổi nội dung chuyển khoản/VietQR từ `HP YYYYMM {student_code}` sang `MMYYYY{student_code}`.
- Ví dụ tháng 09/2026, học viên `Y6_HS9`: `092026Y6_HS9`.
- Không có dấu cách và không có tiền tố `HP`.
- Khi gửi kỳ học phí, backend luôn tính lại `transfer_code` theo format mới trước khi snapshot/gửi.
- Migration chỉ rewrite invoice `DRAFT` và `UNPAID` chưa thu tiền; giữ nguyên `PARTIAL/PAID/CANCELLED`.
