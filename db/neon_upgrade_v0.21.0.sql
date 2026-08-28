-- English Classroom v0.21.0
-- Google Sheets Assessment Mapping
-- Baseline: v0.20.2
-- Safe migration: preserves raw external observations and all manual business data.

BEGIN;

-- ==========================================================
-- 1. EXTERNAL ASSESSMENT DEFINITIONS
-- One logical test/practice block detected from one or more
-- adjacent Google Sheet columns.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_assessments (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES external_data_sources(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  external_assessment_key VARCHAR(64) NOT NULL,
  observed_on DATE,
  title VARCHAR(500) NOT NULL,
  assessment_type VARCHAR(30) NOT NULL DEFAULT 'TEST',
  skill_code VARCHAR(40) REFERENCES skills(code) ON DELETE SET NULL,
  raw_max_score NUMERIC(12,4),
  normalized_max_score NUMERIC(12,4) NOT NULL DEFAULT 10,
  source_column_start INTEGER NOT NULL,
  source_column_end INTEGER NOT NULL,
  mapping_type VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL',
  exam_id BIGINT REFERENCES exams(id) ON DELETE SET NULL,
  assignment_id BIGINT REFERENCES assignments(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_assessments_type_check
    CHECK (assessment_type IN ('TEST','QUIZ','PRACTICE','OTHER')),
  CONSTRAINT external_assessments_mapping_type_check
    CHECK (mapping_type IN ('EXTERNAL','EXAM','ASSIGNMENT')),
  CONSTRAINT external_assessments_status_check
    CHECK (status IN ('ACTIVE','IGNORED')),
  CONSTRAINT external_assessments_mapping_target_check
    CHECK (
      (mapping_type='EXTERNAL' AND exam_id IS NULL AND assignment_id IS NULL) OR
      (mapping_type='EXAM' AND exam_id IS NOT NULL AND assignment_id IS NULL) OR
      (mapping_type='ASSIGNMENT' AND assignment_id IS NOT NULL AND exam_id IS NULL)
    ),
  UNIQUE (source_id, external_assessment_key)
);

CREATE INDEX IF NOT EXISTS idx_external_assessments_source_date
  ON external_assessments(source_id, observed_on DESC, source_column_start);
CREATE INDEX IF NOT EXISTS idx_external_assessments_exam
  ON external_assessments(exam_id) WHERE exam_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_assessments_assignment
  ON external_assessments(assignment_id) WHERE assignment_id IS NOT NULL;

-- ==========================================================
-- 2. EXTERNAL ASSESSMENT RESULTS
-- Keeps both raw score (e.g. 11/20) and normalized /10 score.
-- ==========================================================
CREATE TABLE IF NOT EXISTS external_assessment_results (
  id BIGSERIAL PRIMARY KEY,
  assessment_id BIGINT NOT NULL REFERENCES external_assessments(id) ON DELETE CASCADE,
  sync_run_id BIGINT REFERENCES external_sync_runs(id) ON DELETE SET NULL,
  external_student_key VARCHAR(250) NOT NULL,
  student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
  primary_observation_id BIGINT REFERENCES external_observations(id) ON DELETE SET NULL,
  raw_score NUMERIC(12,4),
  raw_max_score NUMERIC(12,4),
  normalized_score NUMERIC(12,4),
  normalized_max_score NUMERIC(12,4) NOT NULL DEFAULT 10,
  confidence NUMERIC(5,2),
  detection_mode VARCHAR(60),
  warning TEXT,
  raw_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT external_assessment_results_score_check
    CHECK (raw_max_score IS NULL OR raw_max_score > 0),
  CONSTRAINT external_assessment_results_normalized_check
    CHECK (normalized_max_score > 0),
  UNIQUE (assessment_id, external_student_key)
);

CREATE INDEX IF NOT EXISTS idx_external_assessment_results_student
  ON external_assessment_results(student_id, assessment_id)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_assessment_results_warning
  ON external_assessment_results(assessment_id)
  WHERE warning IS NOT NULL;

-- ==========================================================
-- 3. SYNC RUN METRICS
-- ==========================================================
ALTER TABLE external_sync_runs
  ADD COLUMN IF NOT EXISTS assessments_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE external_sync_runs
  ADD COLUMN IF NOT EXISTS assessment_results_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE external_sync_runs
  ADD COLUMN IF NOT EXISTS materialized_assessment_results INTEGER NOT NULL DEFAULT 0;

-- Existing sources need one forced parse after upgrade even if the Sheet body
-- itself has not changed, otherwise v0.21 assessment records would not be built.
UPDATE external_data_sources
   SET last_content_hash=NULL,
       updated_at=NOW()
 WHERE provider='GOOGLE_SHEETS';

COMMIT;
