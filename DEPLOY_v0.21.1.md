# Deploy v0.21.1 from v0.21.0

No database migration is required.

1. Backup current application directory.
2. Deploy v0.21.1 (or copy the patch files).
3. Keep the production `.env` unchanged.
4. Run `npm ci` when deploying the full source.
5. Restart: `pm2 restart all --update-env`.
6. Open **Nguồn dữ liệu → Google Sheets** and click **Đồng bộ ngay**.
   - In v0.21.1 manual sync always re-processes the source even when the Sheet hash is unchanged.
7. Open **Bài kiểm tra / điểm nhận diện → Xem**.
   - `Đã ghi điểm` means the row exists in `student_scores`.
   - `Chưa ghi student_scores` means inspect the warning/mapping/date rule shown on that row.
8. Dashboard/Class/Student average score is refreshed automatically after materialization.

For database diagnosis, run `sql/diagnose_google_sheet_score_v0.21.1.sql`.
