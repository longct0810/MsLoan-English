-- English Classroom v0.25.4
-- Google Sheets Score Deduplication Hotfix
-- PostgreSQL / Neon
--
-- Mục tiêu:
--   1) Sao lưu các student_scores Google Sheets bị trùng.
--   2) Giữ lại đúng 1 bản ghi mới nhất cho cùng logical score.
--   3) Refresh student_progress_summary cho học viên bị ảnh hưởng.
--
-- Logical identity dùng cho cleanup dữ liệu cũ:
--   student_id + class_id + sourceId + ngày + title + category + max_score
-- Không đưa score vào identity để trường hợp Sheet sửa 36/40 -> 38/40 vẫn chỉ còn 1 record.

BEGIN;

-- Backup có thể dùng để phục hồi các dòng bị loại nếu cần.
CREATE TABLE IF NOT EXISTS student_scores_dedup_backup_v0254 AS
SELECT s.*, NOW()::timestamptz AS backed_up_at
FROM student_scores s
WHERE FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_dedup_backup_v0254_id
ON student_scores_dedup_backup_v0254(id);

DROP TABLE IF EXISTS _v0254_duplicate_score_ids;
CREATE TEMP TABLE _v0254_duplicate_score_ids ON COMMIT DROP AS
WITH ranked AS (
    SELECT
        s.id,
        s.student_id,
        ROW_NUMBER() OVER (
            PARTITION BY
                s.student_id,
                s.class_id,
                COALESCE(s.source_payload->>'sourceId', ''),
                s.recorded_at::date,
                BTRIM(s.title),
                COALESCE(s.category, ''),
                s.max_score
            ORDER BY s.id DESC
        ) AS rn
    FROM student_scores s
    WHERE s.source_type = 'GOOGLE_SHEETS'
      AND NULLIF(s.source_payload->>'sourceId', '') IS NOT NULL
)
SELECT id, student_id
FROM ranked
WHERE rn > 1;

-- Preview trong log SQL trước khi xóa.
DO $$
DECLARE
    v_duplicate_count bigint;
    v_student_count bigint;
BEGIN
    SELECT COUNT(*), COUNT(DISTINCT student_id)
    INTO v_duplicate_count, v_student_count
    FROM _v0254_duplicate_score_ids;

    RAISE NOTICE 'v0.25.4: duplicate score rows = %, affected students = %',
        v_duplicate_count, v_student_count;
END $$;

INSERT INTO student_scores_dedup_backup_v0254
SELECT s.*, NOW()::timestamptz
FROM student_scores s
JOIN _v0254_duplicate_score_ids d ON d.id = s.id
ON CONFLICT (id) DO NOTHING;

DELETE FROM student_scores s
USING _v0254_duplicate_score_ids d
WHERE s.id = d.id;

-- Recompute progress exactly theo logic hiện tại của repository cho học viên bị ảnh hưởng.
WITH target AS (
    SELECT DISTINCT student_id
    FROM _v0254_duplicate_score_ids
), score_summary AS (
    SELECT
        t.student_id,
        COALESCE(
            ROUND(AVG((ss.score / NULLIF(ss.max_score, 0)) * 10)::numeric, 2),
            0
        ) AS average_score
    FROM target t
    LEFT JOIN student_scores ss ON ss.student_id = t.student_id
    GROUP BY t.student_id
), session_rows AS (
    SELECT a.student_id, cs.session_date AS attendance_date, a.status
    FROM session_attendance a
    JOIN class_sessions cs ON cs.id = a.session_id
    WHERE a.student_id IN (SELECT student_id FROM target)
), combined_attendance AS (
    SELECT student_id, attendance_date, status
    FROM session_rows
    UNION ALL
    SELECT ar.student_id, ar.attendance_date, ar.status
    FROM attendance_records ar
    WHERE ar.student_id IN (SELECT student_id FROM target)
      AND NOT EXISTS (
          SELECT 1
          FROM session_rows sr
          WHERE sr.student_id = ar.student_id
            AND sr.attendance_date = ar.attendance_date
      )
), attendance_summary AS (
    SELECT
        t.student_id,
        CASE
            WHEN COUNT(c.student_id) = 0 THEN 0
            ELSE ROUND(
                100.0 * COUNT(c.student_id) FILTER (
                    WHERE c.status IN ('PRESENT', 'LATE', 'ONLINE')
                ) / COUNT(c.student_id),
                2
            )
        END AS attendance_rate
    FROM target t
    LEFT JOIN combined_attendance c ON c.student_id = t.student_id
    GROUP BY t.student_id
)
INSERT INTO student_progress_summary(student_id, average_score, attendance_rate, updated_at)
SELECT t.student_id, ss.average_score, att.attendance_rate, NOW()
FROM target t
JOIN score_summary ss ON ss.student_id = t.student_id
JOIN attendance_summary att ON att.student_id = t.student_id
ON CONFLICT(student_id)
DO UPDATE SET
    average_score = EXCLUDED.average_score,
    attendance_rate = EXCLUDED.attendance_rate,
    updated_at = NOW();

COMMIT;

-- Kiểm tra sau migration: query này phải trả về 0 dòng.
SELECT
    student_id,
    class_id,
    source_payload->>'sourceId' AS source_id,
    recorded_at::date AS score_date,
    title,
    category,
    max_score,
    COUNT(*) AS duplicate_count
FROM student_scores
WHERE source_type = 'GOOGLE_SHEETS'
  AND NULLIF(source_payload->>'sourceId', '') IS NOT NULL
GROUP BY
    student_id,
    class_id,
    source_payload->>'sourceId',
    recorded_at::date,
    title,
    category,
    max_score
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, student_id, score_date;
