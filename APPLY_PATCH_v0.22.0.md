# Apply patch v0.22.0

Baseline: v0.21.2. Chép đè các file trong patch, chạy `db/neon_upgrade_v0.22.0.sql`, sau đó `npm ci` và restart PM2. Không chép đè `.env`.
