-- English Classroom v0.26.0
-- Assignment follow-up, score sentinels, and teacher social contacts.

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_social_links (
  teacher_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  facebook_url TEXT,
  messenger_url TEXT,
  zalo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE student_progress_summary ps
   SET average_score = COALESCE((
         SELECT ROUND((AVG((ss.score / NULLIF(ss.max_score, 0)) * 10)
                       FILTER (WHERE ss.score > 0))::numeric, 2)
           FROM student_scores ss
          WHERE ss.student_id = ps.student_id
       ), 0),
       updated_at = NOW();

COMMIT;

-- Verification: averages are computed only from positive numeric scores.
SELECT ps.student_id, ps.average_score,
       ROUND((AVG((ss.score / NULLIF(ss.max_score, 0)) * 10)
              FILTER (WHERE ss.score > 0))::numeric, 2) AS expected_average
  FROM student_progress_summary ps
  LEFT JOIN student_scores ss ON ss.student_id = ps.student_id
 GROUP BY ps.student_id, ps.average_score
 ORDER BY ps.student_id;