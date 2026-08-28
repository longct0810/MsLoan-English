-- English Classroom v0.20.0
-- Google Sheets Data Source / Teacher Tracking Sync
-- Baseline: v0.19.1 (v0.19.1 itself has no DB schema delta from v0.19.0)
-- Safe migration: no DROP TABLE, no DELETE business data.

BEGIN;

-- ==========================================================
-- 1. EXTERNAL DATA SOURCES
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_data_sources (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_SHEETS',
  name VARCHAR(250) NOT NULL,
  spreadsheet_id VARCHAR(200) NOT NULL,
  sheet_gid VARCHAR(50) NOT NULL DEFAULT '0',
  source_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (sync_interval_minutes BETWEEN 5 AND 1440),
  import_from_date DATE,
  import_to_date DATE,
  last_content_hash VARCHAR(64),
  last_synced_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_data_sources_provider_check
    CHECK (provider IN ('GOOGLE_SHEETS')),
  CONSTRAINT external_data_sources_date_window_check
    CHECK (import_to_date IS NULL OR import_from_date IS NULL OR import_to_date >= import_from_date),
  UNIQUE (teacher_id, class_id, provider, spreadsheet_id, sheet_gid)
);

CREATE INDEX IF NOT EXISTS idx_external_data_sources_due
  ON external_data_sources(enabled, last_synced_at, sync_interval_minutes);
CREATE INDEX IF NOT EXISTS idx_external_data_sources_teacher
  ON external_data_sources(teacher_id, class_id, enabled);

-- ==========================================================
-- 2. SYNC RUN HISTORY
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  content_hash VARCHAR(64),
  rows_read INTEGER NOT NULL DEFAULT 0,
  students_seen INTEGER NOT NULL DEFAULT 0,
  students_matched INTEGER NOT NULL DEFAULT 0,
  observations_seen INTEGER NOT NULL DEFAULT 0,
  observations_inserted INTEGER NOT NULL DEFAULT 0,
  observations_updated INTEGER NOT NULL DEFAULT 0,
  materialized_scores INTEGER NOT NULL DEFAULT 0,
  materialized_attendance INTEGER NOT NULL DEFAULT 0,
  materialized_notes INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT external_sync_runs_status_check
    CHECK (status IN ('RUNNING','SUCCESS','NO_CHANGE','PARTIAL','FAILED','LOCKED')),
  CONSTRAINT external_sync_runs_trigger_check
    CHECK (trigger_type IN ('SCHEDULED','MANUAL','CLI'))
);

CREATE INDEX IF NOT EXISTS idx_external_sync_runs_source_started
  ON external_sync_runs(source_id, started_at DESC);

-- ==========================================================
-- 3. EXTERNAL STUDENT -> INTERNAL STUDENT MAPPING
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_student_links (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  external_student_key VARCHAR(250) NOT NULL,
  external_student_name VARCHAR(250) NOT NULL,
  external_row_hint VARCHAR(100),
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  match_status VARCHAR(20) NOT NULL DEFAULT 'UNMATCHED',
  match_method VARCHAR(30),
  confidence NUMERIC(5,2),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_student_links_match_status_check
    CHECK (match_status IN ('MATCHED','UNMATCHED','AMBIGUOUS','IGNORED')),
  UNIQUE (source_id, external_student_key)
);

CREATE INDEX IF NOT EXISTS idx_external_student_links_student
  ON external_student_links(student_id, source_id)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_student_links_unmatched
  ON external_student_links(source_id, match_status)
  WHERE match_status <> 'MATCHED';

-- ==========================================================
-- 4. RAW / NORMALIZED OBSERVATIONS
-- Every non-empty teacher cell is preserved here before it is
-- optionally materialized into core business tables.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_observations (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  sync_run_id BIGINT REFERENCES external_sync_runs(id) ON DELETE SET NULL,
  external_student_key VARCHAR(250) NOT NULL,
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  observed_on DATE,
  source_column_index INTEGER NOT NULL,
  field_name TEXT,
  observation_type VARCHAR(30) NOT NULL,
  skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE SET NULL,
  raw_value TEXT NOT NULL,
  numeric_value NUMERIC(12,4),
  max_value NUMERIC(12,4),
  normalized_status VARCHAR(50),
  observation_key VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  warning TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_observations_type_check
    CHECK (observation_type IN ('SCORE','ATTENDANCE','LEVEL','HOMEWORK_STATUS','NOTE','TEXT')),
  UNIQUE (source_id, observation_key)
);

CREATE INDEX IF NOT EXISTS idx_external_observations_student_date
  ON external_observations(student_id, observed_on DESC)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_observations_source_date
  ON external_observations(source_id, observed_on DESC, observation_type);
CREATE INDEX IF NOT EXISTS idx_external_observations_unmatched
  ON external_observations(source_id, external_student_key)
  WHERE student_id IS NULL;

-- ==========================================================
-- 5. SHEET DATE -> CLASS SESSION MAPPING
-- Avoids accidentally attaching attendance to the wrong session.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_session_links (
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,
  class_session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  link_method VARCHAR(30) NOT NULL DEFAULT 'AUTO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_id, observed_on),
  CONSTRAINT external_session_links_method_check
    CHECK (link_method IN ('AUTO','MANUAL','CREATED_BY_SYNC'))
);

CREATE INDEX IF NOT EXISTS idx_external_session_links_session
  ON external_session_links(class_session_id);

-- ==========================================================
-- 6. SOURCE TRACEABILITY ON CORE TABLES
-- Existing rows stay MANUAL and are never deleted by this sync.
-- ==========================================================
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE student_scores
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_scores_source_ref
  ON student_scores(student_id, source_type, source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE teacher_notes
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_notes_source_ref
  ON teacher_notes(student_id, source_type, source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(200);
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- v0.17.0 restricted skill event sources to legacy/internal sources.
-- Extend it for safe traceable external events.
ALTER TABLE student_skill_events
  DROP CONSTRAINT IF EXISTS student_skill_events_source_type_check;
ALTER TABLE student_skill_events
  ADD CONSTRAINT student_skill_events_source_type_check
  CHECK(source_type IN ('LEGACY','ASSIGNMENT','EXAM','MANUAL','EXTERNAL'));

COMMIT;

-- ==========================================================
-- 7. VERIFY
-- ==========================================================
SELECT 'external_data_sources' AS entity, COUNT(*) AS total FROM external_data_sources
UNION ALL SELECT 'external_sync_runs', COUNT(*) FROM external_sync_runs
UNION ALL SELECT 'external_student_links', COUNT(*) FROM external_student_links
UNION ALL SELECT 'external_observations', COUNT(*) FROM external_observations
UNION ALL SELECT 'external_session_links', COUNT(*) FROM external_session_links;
