# Apply patch v0.21.1

Baseline: v0.21.0.

```bash
unzip english-classroom-v0.21.1-patch.zip -d /tmp/v0211
cp -a /tmp/v0211/english-classroom-v0.21.1-patch/src/. ./src/
cp /tmp/v0211/english-classroom-v0.21.1-patch/package.json ./package.json
cp /tmp/v0211/english-classroom-v0.21.1-patch/package-lock.json ./package-lock.json 2>/dev/null || true
cp /tmp/v0211/english-classroom-v0.21.1-patch/VERSION ./VERSION
pm2 restart all --update-env
```

Không cần migration DB.

Sau restart, vào **Nguồn dữ liệu** và bấm **Đồng bộ ngay**. Manual sync v0.21.1 luôn re-process toàn bộ source dù SHA-256 không đổi.
