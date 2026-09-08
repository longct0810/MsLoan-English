# Deploy v0.25.3

## Từ v0.25.2

Không cần migration DB.

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

## Nếu runtime hiện vẫn là v0.25.0 hoặc v0.25.1

1. Chạy `db/neon_upgrade_v0.25.2.sql` nếu chưa chạy.
2. Deploy full source v0.25.3.
3. `npm ci` và restart PM2.

Sau deploy, kiểm tra footer/version phải là `v0.25.3`.
