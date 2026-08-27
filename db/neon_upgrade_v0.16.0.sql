BEGIN;

-- v0.16.0 - Electronic class journal / session log.
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS session_goal TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS teacher_summary TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS parent_summary TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS next_session_plan TEXT;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS parent_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_sessions_completed
  ON class_sessions(class_id, completed_at DESC)
  WHERE status='COMPLETED';

COMMIT;
