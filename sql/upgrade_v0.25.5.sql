-- English Classroom v0.25.5
-- Google Sheets automatic sync interval: every 3 days
-- PostgreSQL / Neon
--
-- 3 days = 4320 minutes.
-- Manual sync is unaffected.
-- The scheduler can continue checking for due sources frequently; only sources
-- whose last sync is >= 4320 minutes old will be scheduled automatically.

BEGIN;

-- 1) Remove the old CHECK constraint(s) that cap sync_interval_minutes at 1440.
-- The original v0.20.0 schema created the CHECK inline, so PostgreSQL usually
-- named it external_data_sources_sync_interval_minutes_check. This dynamic block
-- is resilient if the actual constraint name differs.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'c'
          AND n.nspname = current_schema()
          AND t.relname = 'external_data_sources'
          AND pg_get_constraintdef(c.oid) ILIKE '%sync_interval_minutes%'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT %I',
            current_schema(),
            'external_data_sources',
            r.conname
        );
    END LOOP;
END $$;

-- 2) Default for newly created data sources.
ALTER TABLE external_data_sources
    ALTER COLUMN sync_interval_minutes SET DEFAULT 4320;

-- 3) Convert all current Google Sheets sources to 3 days/lần.
UPDATE external_data_sources
SET sync_interval_minutes = 4320,
    updated_at = NOW()
WHERE provider = 'GOOGLE_SHEETS'
  AND sync_interval_minutes IS DISTINCT FROM 4320;

-- 4) Allow values up to 7 days at schema level. Google Sheets itself is fixed
-- to 4320 below; the wider range keeps the column reusable and avoids a hard
-- one-day ceiling inherited from v0.20.0.
ALTER TABLE external_data_sources
    ADD CONSTRAINT external_data_sources_sync_interval_minutes_check
    CHECK (sync_interval_minutes BETWEEN 5 AND 10080);

-- 5) DB-side safety: even if an older application build still sends 15 minutes,
-- Google Sheets sources are normalized to 4320 minutes on INSERT/UPDATE.
CREATE OR REPLACE FUNCTION enforce_google_sheet_sync_interval_v0255()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.provider = 'GOOGLE_SHEETS' THEN
        NEW.sync_interval_minutes := 4320;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_sheet_sync_interval_v0255
ON external_data_sources;

CREATE TRIGGER trg_google_sheet_sync_interval_v0255
BEFORE INSERT OR UPDATE OF provider, sync_interval_minutes
ON external_data_sources
FOR EACH ROW
EXECUTE FUNCTION enforce_google_sheet_sync_interval_v0255();

COMMIT;

-- Verification: all Google Sheets sources should report 4320.
SELECT
    id,
    teacher_id,
    class_id,
    provider,
    name,
    sync_interval_minutes,
    last_synced_at,
    last_success_at
FROM external_data_sources
WHERE provider = 'GOOGLE_SHEETS'
ORDER BY id;
