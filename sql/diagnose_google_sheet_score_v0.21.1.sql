-- English Classroom v0.21.1
-- Diagnose Google Sheets score materialization for one student.
-- Replace the name if needed.

-- 1) Student and progress summary
SELECT s.id AS student_id,
       s.full_name,
       sp.average_score,
       sp.attendance_rate,
       sp.updated_at AS progress_updated_at
  FROM students s
  LEFT JOIN student_progress_summary sp ON sp.student_id=s.id
 WHERE lower(unaccent(s.full_name)) = lower(unaccent('Cao Gia Linh'));

-- If Neon does not have unaccent extension, use this instead:
-- SELECT s.id,s.full_name,sp.average_score,sp.attendance_rate,sp.updated_at
-- FROM students s LEFT JOIN student_progress_summary sp ON sp.student_id=s.id
-- WHERE s.full_name ILIKE '%Cao Gia Linh%';

-- 2) Mapping from Google Sheet to student
SELECT ds.id AS source_id,
       ds.name AS source_name,
       l.external_student_key,
       l.external_student_name,
       l.student_id,
       l.match_status,
       l.match_method,
       l.updated_at
  FROM external_student_links l
  JOIN external_data_sources ds ON ds.id=l.source_id
 WHERE l.external_student_name ILIKE '%Cao Gia Linh%'
 ORDER BY l.updated_at DESC;

-- 3) Assessment results detected from the Sheet
SELECT a.id AS assessment_id,
       a.observed_on,
       a.title,
       a.skill_code,
       a.raw_max_score AS assessment_max,
       ar.id AS result_id,
       ar.student_id,
       ar.raw_score,
       ar.raw_max_score,
       ar.normalized_score,
       ar.normalized_max_score,
       ar.detection_mode,
       ar.warning,
       ar.updated_at
  FROM external_assessment_results ar
  JOIN external_assessments a ON a.id=ar.assessment_id
  JOIN external_student_links l
    ON l.source_id=a.source_id
   AND l.external_student_key=ar.external_student_key
 WHERE l.external_student_name ILIKE '%Cao Gia Linh%'
 ORDER BY a.observed_on DESC NULLS LAST,a.source_column_start;

-- 4) Scores actually materialized into the business table
SELECT ss.id,
       ss.student_id,
       ss.class_id,
       ss.recorded_at,
       ss.title,
       ss.category,
       ss.score,
       ss.max_score,
       ROUND((ss.score / NULLIF(ss.max_score,0) * 10)::numeric,2) AS score_on_10,
       ss.source_type,
       ss.source_ref,
       ss.source_payload
  FROM student_scores ss
  JOIN students s ON s.id=ss.student_id
 WHERE s.full_name ILIKE '%Cao Gia Linh%'
 ORDER BY ss.recorded_at DESC,ss.id DESC;

-- 5) Recent sync run counters
SELECT r.id,r.started_at,r.status,r.students_matched,r.assessments_seen,
       r.assessment_results_seen,r.materialized_assessment_results,
       r.materialized_scores,r.skipped,r.errors_count,r.message,r.details
  FROM external_sync_runs r
  JOIN external_data_sources ds ON ds.id=r.source_id
 ORDER BY r.started_at DESC
 LIMIT 10;
