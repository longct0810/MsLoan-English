# Apply patch v0.23.1 từ v0.23.0

Không có migration database.

Copy đè các file trong patch vào source v0.23.0, sau đó:

```bash
pm2 restart all --update-env
```

Hard refresh trình duyệt (`Ctrl+Shift+R`).
