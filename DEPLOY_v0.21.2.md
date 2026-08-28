# Deploy v0.21.2 from v0.21.1

1. Backup current source. No database migration is required.
2. Deploy v0.21.2 source or apply the patch.
3. Run `npm ci` if deploying the full source.
4. Restart: `pm2 restart all --update-env`.
5. Open **Nguồn dữ liệu** and click **Đồng bộ ngay** once. Manual sync re-processes even when the Sheet hash has not changed.
6. Verify Cao Gia Linh: 2026 assessment rows without parser warnings should become `student_scores`; 2027 future rows remain staging-only.

Optional check:
```sql
SELECT source_type, COUNT(*)
FROM student_scores
WHERE student_id=9
GROUP BY source_type;
```
