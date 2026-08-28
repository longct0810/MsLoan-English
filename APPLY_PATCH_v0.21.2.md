# Apply patch v0.21.2

From the deployed v0.21.1 project root:

```bash
unzip english-classroom-v0.21.2-patch.zip -d /tmp/v0212
cp -a /tmp/v0212/english-classroom-v0.21.2-patch/src/. ./src/
cp -a /tmp/v0212/english-classroom-v0.21.2-patch/test/. ./test/
cp /tmp/v0212/english-classroom-v0.21.2-patch/package.json ./package.json
cp /tmp/v0212/english-classroom-v0.21.2-patch/package-lock.json ./package-lock.json
cp /tmp/v0212/english-classroom-v0.21.2-patch/VERSION ./VERSION
pm2 restart all --update-env
```

No SQL migration is required. Then click **Đồng bộ ngay** once.
