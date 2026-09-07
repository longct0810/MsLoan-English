# Deploy v0.25.0 từ v0.24.3

## 1. Backup

Tạo branch/backup Neon trước khi migration.

## 2. Migration

Chạy:

```sql
\i db/neon_upgrade_v0.25.0.sql
```

Hoặc copy toàn bộ nội dung file vào Neon SQL Editor.

Migration không tạo bảng/cột mới; nó cập nhật `external_data_sources.settings` và reset `last_content_hash`.

## 3. Deploy source

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

Nếu `.env` đang hard-code `APP_VERSION`, đổi thành `0.25.0` hoặc bỏ biến để lấy từ `package.json`.

## 4. Bắt buộc cấu hình 4 Google Sheet

Với từng nguồn:

`Nguồn dữ liệu -> nguồn lớp -> Cấu hình & Dry-run`

- AUTO trước.
- Xác nhận số học viên.
- Xác nhận `Điểm danh > 0` nếu nguồn có chuyên cần.
- Xác nhận số điểm/bài test hợp lý.
- Kiểm tra ngày đầu/ngày cuối.
- Override cột nếu cần.
- Tick **Xác nhận cấu trúc để cho phép ghi DB**.

Sau đó bấm **Đồng bộ ngay**.

## 5. Kiểm tra DB

```sql
SELECT id,name,class_id,
       settings->'sheet_profile' AS sheet_profile,
       settings->>'require_confirmed_sheet_profile' AS require_confirmation
FROM external_data_sources
ORDER BY id;
```

Kiểm tra điểm danh:

```sql
SELECT source_id, observation_type, COUNT(*)
FROM external_observations
GROUP BY source_id, observation_type
ORDER BY source_id, observation_type;
```
