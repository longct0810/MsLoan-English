# English Classroom v0.25.4

Hotfix tập trung vào tính idempotent của Google Sheets score sync.

Không thay đổi giao diện và không thay đổi cấu trúc chính của `student_scores`. Bản này tương thích trực tiếp từ v0.25.3, nhưng cần chạy `sql/upgrade_v0.25.4.sql` một lần để dọn dữ liệu duplicate đã phát sinh trước đó.
