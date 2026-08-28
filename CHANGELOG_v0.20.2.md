# v0.20.2 — Student persistence hotfix

## Fixed
- Prevent accidental production startup with `DEMO_MODE=true`.
- `.env.example` now defaults to `DEMO_MODE=false` and hides demo accounts.
- Add a prominent UI warning whenever DEMO_MODE is enabled.
- `/health` now reports `storageMode` and `demoMode` for quick diagnosis.

## Root cause
When `DEMO_MODE=true`, student/class CRUD uses the in-memory `demo-store`. The UI can therefore show a newly created student and a success message, but no row is inserted into PostgreSQL/Neon. Google Sheets Data Source mapping reads PostgreSQL, so that student is absent there.

## Database
No migration is required from v0.20.1.
