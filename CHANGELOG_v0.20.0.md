# v0.20.0

## Added
- Google Sheets teacher tracking data source.
- 15-minute default per-source periodic sync.
- SHA-256 no-change detection.
- Dynamic two-row date/header parser without hard-coded column positions.
- Vietnamese exact-name student matching + persistent manual mapping.
- Raw/staging observation audit.
- Safe score, skill, attendance and internal-note materialization.
- Sync run history and source management UI.
- PM2/multi-instance PostgreSQL advisory lock.
- CLI one-shot sync using the same DB config as the app.
- Desktop/mobile navigation integration.
- v0.20 cumulative schema and Neon upgrade migration.

## Safety
- Data-source UI is TEACHER-only; source ownership is scoped by `teacher_id`.
- No automatic student creation.
- No automatic business-data deletion.
- Manual attendance wins over imported attendance.
- Future/out-of-window dates are staged only.
- Imported notes are parent-private by default.
- Ambiguous merged/unnamed Sheet columns remain staging-only unless classification is safe.

## Quality
- 8 parser/classifier tests.
- 5 source-integration/wiring tests.
