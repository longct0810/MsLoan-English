# Changelog v0.25.4

## Google Sheets Score Deduplication Hotfix

### Fixed

- Sửa lỗi một điểm Google Sheets xuất hiện nhiều lần trong `student_scores`/Lịch sử điểm sau các lần đồng bộ.
- Chuyển materialized score reference từ surrogate DB id sang deterministic parser key.
- Tự dọn legacy score refs trong cùng transaction materialization.
- Khi Google Sheet sửa điểm, logical score cũ được thay thế thay vì tạo lịch sử giả.
- Dọn dữ liệu duplicate hiện có và refresh `student_progress_summary`.

### Database

- Không thêm cột vào schema nghiệp vụ.
- Thêm bảng backup migration: `student_scores_dedup_backup_v0254`.
