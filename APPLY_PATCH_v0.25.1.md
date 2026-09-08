# Apply patch v0.25.1

Baseline: v0.25.0.
Không cần migration DB.

Sau khi chép patch:

```bash
npm ci
pm2 restart all --update-env
```

Kỳ DRAFT đã tạo trước đó cần tạo lại để áp dụng logic mới.
