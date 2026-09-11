# Deploy v0.25.4

## Thứ tự khuyến nghị

1. Backup Neon.
2. Apply source patch bằng `node apply_v0.25.4.js`.
3. Chạy `sql/upgrade_v0.25.4.sql` trên Neon.
4. `npm test`.
5. Commit/push lên `main` để Render auto-deploy.
6. Kiểm tra `/health` hoặc màn hình đăng nhập sau deploy.
7. Đăng nhập TEACHER, vào Data Sources và bấm **Đồng bộ ngay**.
8. Thực hiện sync thêm 2 lần để kiểm tra tính idempotent.
9. Mở tài khoản PARENT/STUDENT và kiểm tra **Lịch sử điểm**: mỗi bài chỉ còn 1 dòng.

## Query kiểm tra nhanh

```sql
SELECT
  student_id,
  recorded_at::date,
  title,
  category,
  max_score,
  COUNT(*)
FROM student_scores
WHERE source_type='GOOGLE_SHEETS'
GROUP BY student_id, recorded_at::date, title, category, max_score
HAVING COUNT(*) > 1;
```

Sau migration/sync, query nên trả về 0 dòng đối với logical score từ cùng nguồn.
