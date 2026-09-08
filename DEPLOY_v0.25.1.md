# Deploy v0.25.1

Không cần migration database từ v0.25.0.

1. Deploy source/patch v0.25.1.
2. `npm ci`
3. `pm2 restart all --update-env`
4. Xóa kỳ học phí DRAFT cần test lại hoặc tạo lại kỳ; `generateCycle` sẽ rebuild invoice từ attendance trong kỳ.
