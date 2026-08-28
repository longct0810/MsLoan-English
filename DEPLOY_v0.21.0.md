# Deploy English Classroom v0.21.0

Baseline yêu cầu: v0.20.2.

```bash
# 1. chạy migration trên Neon
# db/neon_upgrade_v0.21.0.sql

# 2. cài dependency đúng lockfile
npm ci

# 3. restart
pm2 restart all --update-env
```

Sau deploy, vào Teacher > Nguồn dữ liệu > nguồn Google Sheets > Đồng bộ ngay.
Migration đã reset `last_content_hash`, vì vậy lần sync đầu tiên sẽ parse lại Sheet và tạo `external_assessments` / `external_assessment_results`.

Kiểm tra nhanh:

```sql
SELECT id,title,observed_on,raw_max_score,mapping_type
FROM external_assessments
ORDER BY observed_on DESC,id DESC;

SELECT a.title,r.external_student_key,r.raw_score,r.raw_max_score,
       r.normalized_score,r.normalized_max_score,r.warning
FROM external_assessment_results r
JOIN external_assessments a ON a.id=r.assessment_id
ORDER BY a.observed_on DESC,a.id,r.external_student_key;
```
