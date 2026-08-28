-- English Classroom v0.22.0 - verify Google Sheets -> Skill Analytics
-- Đổi tên học viên nếu cần.

-- 1) Student + class membership
SELECT s.id AS student_id,s.full_name,c.id AS class_id,c.name AS class_name
FROM students s
JOIN class_students cs ON cs.student_id=s.id AND cs.status='ACTIVE'
JOIN classes c ON c.id=cs.class_id AND c.deleted_at IS NULL
WHERE lower(trim(s.full_name))=lower(trim('Cao Gia Linh'))
ORDER BY c.id;

-- 2) Skill events, chú ý source_type=EXTERNAL là dữ liệu Google Sheets
SELECT e.id,e.student_id,e.class_id,e.skill_code,e.source_type,e.source_id,
       e.score::float,e.max_score::float,
       ROUND((e.score/NULLIF(e.max_score,0)*10)::numeric,2) AS score_on_10,
       e.weight::float,e.recorded_at
FROM student_skill_events e
JOIN students s ON s.id=e.student_id
WHERE lower(trim(s.full_name))=lower(trim('Cao Gia Linh'))
ORDER BY e.recorded_at DESC,e.id DESC;

-- 3) Tổng hợp giống màn Theo dõi kỹ năng (toàn bộ lớp)
SELECT e.class_id,e.skill_code,
       ROUND((SUM((e.score/NULLIF(e.max_score,0))*10*e.weight)/NULLIF(SUM(e.weight),0))::numeric,2) AS average_on_10,
       COUNT(*) AS event_count,
       MAX(e.recorded_at) AS last_recorded_at
FROM student_skill_events e
JOIN students s ON s.id=e.student_id
WHERE lower(trim(s.full_name))=lower(trim('Cao Gia Linh'))
GROUP BY e.class_id,e.skill_code
ORDER BY e.class_id,e.skill_code;

-- 4) Assessment Google Sheets chưa có skill mapping
SELECT a.id,a.observed_on,a.title,a.skill_code,a.metadata
FROM external_assessments a
JOIN external_data_sources ds ON ds.id=a.source_id
WHERE a.status='ACTIVE'
  AND a.skill_code IS NULL
ORDER BY a.observed_on DESC NULLS LAST,a.id;
