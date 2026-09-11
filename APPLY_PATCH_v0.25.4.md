# APPLY PATCH v0.25.4

## Phạm vi

Hotfix lỗi điểm Google Sheets bị duplicate sau khi đồng bộ.

## Nguyên nhân

`student_scores.source_ref` của v0.25.3 đang materialize bằng surrogate database IDs như `external-observation:{id}` hoặc `external-assessment-result:{id}`. Unique index chỉ ngăn duplicate khi `source_ref` giống nhau. Khi staging/result bị tạo lại hoặc luồng parser thay đổi, cùng một logical score có thể nhận `source_ref` khác và tồn tại thành nhiều dòng.

## Cách áp dụng

1. Giải nén bundle vào root repo `MsLoan-English`.
2. Chạy:

```bash
node apply_v0.25.4.js
git diff
```

3. Backup Neon trước khi migration.
4. Chạy `sql/upgrade_v0.25.4.sql` trong Neon SQL Editor.
5. Chạy test:

```bash
npm test
```

6. Commit/push:

```bash
git add .
git commit -m "fix: dedupe Google Sheets scores v0.25.4"
git push
```

7. Chờ Render deploy xong, sau đó bấm **Đồng bộ ngay** liên tiếp 2-3 lần. Một bài kiểm tra của một học viên chỉ được còn **1 dòng** trong Lịch sử điểm.

## Hành vi sau hotfix

- Assessment score dùng canonical ref: `google-sheet-assessment:{external_assessment_key}`.
- Direct score dùng canonical ref: `google-sheet-observation:{observation_key}`.
- Mỗi lần materialize sẽ dọn các ref legacy và các record Google Sheets cùng logical identity trong cùng transaction.
- Nếu điểm trên Sheet đổi từ `36/40` sang `38/40`, hệ thống cập nhật thành một record `38/40`, không giữ thêm record `36/40`.
- Migration backup các row bị loại vào `student_scores_dedup_backup_v0254`.
