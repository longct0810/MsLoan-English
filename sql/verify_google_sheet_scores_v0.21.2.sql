-- English Classroom v0.21.2
-- Verify Google Sheets assessment -> student_scores for Cao Gia Linh (student_id=9).

SELECT
  ar.student_id,
  a.observed_on,
  a.title,
  ar.raw_score,
  ar.raw_max_score,
  ar.normalized_score,
  ar.normalized_max_score,
  ar.warning,
  ss.id AS student_score_id,
  ss.score AS db_score,
  ss.max_score AS db_max_score,
  ss.source_type,
  CASE
    WHEN a.observed_on > CURRENT_DATE THEN 'FUTURE_DATE'
    WHEN ar.warning IS NOT NULL THEN 'STAGING_WARNING'
    WHEN ss.id IS NOT NULL THEN 'MATERIALIZED'
    ELSE 'NOT_MATERIALIZED'
  END AS status
FROM external_assessment_results ar
JOIN external_assessments a ON a.id = ar.assessment_id
LEFT JOIN student_scores ss
  ON ss.student_id = ar.student_id
 AND ss.source_type = 'GOOGLE_SHEETS'
 AND ss.source_ref = CASE
      WHEN ar.primary_observation_id IS NOT NULL
        THEN 'external-observation:' || ar.primary_observation_id::text
      ELSE 'external-assessment-result:' || ar.id::text
    END
WHERE ar.student_id = 9
ORDER BY a.observed_on DESC NULLS LAST, a.source_column_start;
