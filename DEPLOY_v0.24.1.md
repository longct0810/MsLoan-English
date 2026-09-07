# Deploy v0.24.1

Baseline: v0.24.0.

## Database

Không cần migration schema.

Có thể chạy `db/verify_shared_parent_v0.24.1.sql` để rà soát dữ liệu phụ huynh nhiều con và đồng bộ lại các cột legacy nếu cần.

## Deploy

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

Sau deploy, xác nhận giao diện hiển thị `v0.24.1`.
