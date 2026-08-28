# v0.20.0

## Added
- Google Sheets teacher tracking source.
- 15-minute per-source periodic sync.
- SHA-256 no-change detection.
- Dynamic two-row date/header parser, no hard-coded column positions.
- Vietnamese exact-name student matching + persistent manual mapping.
- Raw/staging observation audit.
- Safe score, skill, attendance and internal-note materialization.
- Sync run history and source management UI.
- PM2/multi-instance PostgreSQL advisory lock.
- CLI one-shot sync.
- 7 parser/classifier unit tests.

## Safety
- No automatic student creation.
- No automatic business-data deletion.
- Manual attendance wins over imported attendance.
- Future dates are staged only.
- Imported notes are parent-private by default.
