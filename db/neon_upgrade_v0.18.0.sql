BEGIN;

-- v0.18.0 - Assignment 2.0: file/audio submissions and skill rubric grading.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submission_mode VARCHAR(20) NOT NULL DEFAULT 'TEXT';
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_submission_mode_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_submission_mode_check CHECK(submission_mode IN ('TEXT','FILE','AUDIO','MIXED'));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS rubric_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS rubric_scores JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS rubric_feedback TEXT;

CREATE TABLE IF NOT EXISTS assignment_submission_assets (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes >= 0),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_assignment_submission_asset FOREIGN KEY(assignment_id,student_id)
    REFERENCES assignment_submissions(assignment_id,student_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assignment_submission_assets_submission
  ON assignment_submission_assets(assignment_id,student_id,created_at);

COMMIT;
