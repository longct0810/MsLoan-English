# Apply patch v0.24.2

Baseline: v0.24.1. Không cần migration DB.

Chép đè các file trong patch vào project, sau đó:

```bash
pm2 restart all --update-env
pm2 save
```

Sau đó bấm **Đồng bộ ngay** cho nguồn Google Sheet lớp 9.
