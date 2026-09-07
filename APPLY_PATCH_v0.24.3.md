# Apply patch v0.24.3

Nâng từ **v0.24.2** lên **v0.24.3**.

Không có migration database.

Các file runtime chính thay đổi:
- `src/modules/data-sources/google-sheet-csv.js`
- `package.json`
- `package-lock.json`
- `VERSION`

Sau khi copy patch:

```bash
npm ci
pm2 restart all --update-env
pm2 save
```

Sau đó vào **Nguồn dữ liệu -> Lớp 9 -> Đồng bộ ngay**.
