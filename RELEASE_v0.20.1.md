# English Classroom v0.20.1

Hotfix cho module Google Sheets Data Source.

## Deploy từ v0.20.0

1. Backup source hiện tại.
2. Không cần chạy SQL migration.
3. Deploy source v0.20.1.
4. `npm ci` nếu deploy full source hoặc giữ nguyên `node_modules` nếu chỉ chép patch.
5. Restart PM2/application.
6. Mở `/teacher/data-sources/:id` và kiểm tra dropdown mapping.

Khi chọn học sinh đang thuộc lớp khác của cùng giáo viên, thao tác **Liên kết** sẽ tự thêm/kích hoạt membership vào lớp nguồn trước khi lưu mapping.
