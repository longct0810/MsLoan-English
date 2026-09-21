# Deploy v0.25.5

## 1. Copy patch vào repo

Copy:

- `apply_v0.25.5.js`
- `sql/upgrade_v0.25.5.sql`

vào root repo `MsLoan-English`.

## 2. Patch source/version

```bash
node apply_v0.25.5.js
git diff
```

## 3. Upgrade Neon

Chạy toàn bộ file:

```text
sql/upgrade_v0.25.5.sql
```

Sau migration, kiểm tra:

```sql
SELECT id, name, sync_interval_minutes, last_synced_at
FROM external_data_sources
WHERE provider = 'GOOGLE_SHEETS';
```

`sync_interval_minutes` phải bằng `4320`.

## 4. Test

```bash
npm test
```

Kiểm tra nghiệp vụ:

1. Bấm **Đồng bộ ngay** vẫn chạy ngay.
2. Sau manual sync, `last_synced_at` được cập nhật.
3. Scheduler không tự sync lại trước khi đủ 3 ngày.
4. Khi đủ 3 ngày, nguồn trở thành due và được scheduler xử lý.

## 5. Commit/deploy

```bash
git add .
git commit -m "chore: v0.25.5 set Google Sheets sync to every 3 days"
git push origin main
```

Render auto-deploy theo cấu hình hiện tại.
