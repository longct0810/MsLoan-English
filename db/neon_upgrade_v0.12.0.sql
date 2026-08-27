-- English Classroom v0.12.0
-- Persist read state for derived parent notifications.
BEGIN;

CREATE TABLE IF NOT EXISTS parent_notification_reads (
  parent_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key VARCHAR(500) NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_user_id, notification_key)
);

CREATE INDEX IF NOT EXISTS idx_parent_notification_reads_parent
  ON parent_notification_reads(parent_user_id, read_at DESC);

COMMIT;