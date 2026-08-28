SELECT id,name,provider,class_id,enabled,sync_interval_minutes,last_synced_at,last_success_at,last_error
FROM external_data_sources
ORDER BY id;

SELECT source_id,status,trigger_type,started_at,finished_at,students_matched,students_seen,
       observations_seen,materialized_scores,materialized_attendance,materialized_notes,message
FROM external_sync_runs
ORDER BY id DESC
LIMIT 20;

SELECT source_id,external_student_name,student_id,match_status,match_method,last_seen_at
FROM external_student_links
ORDER BY source_id,external_student_name;

SELECT source_id,observed_on,observation_type,skill_code,field_name,raw_value,numeric_value,max_value,
       normalized_status,warning,student_id
FROM external_observations
ORDER BY id DESC
LIMIT 100;
