# v0.21.2 - Google Sheets DATE Boundary Hotfix

- Fix backend date-range validation when PostgreSQL `DATE` values are returned by `pg` as JavaScript `Date` objects.
- v0.21.1 used `String(date).slice(0,10)`, producing values such as `Thu Jan 01`; lexical comparison then incorrectly marked every ISO observation date as before `import_from_date`.
- Normalize `import_from_date` / `import_to_date` to `YYYY-MM-DD` before comparison.
- Keep future-date and explicit import range protections intact.
- No database migration required from v0.21.1.
- After deploy, use **Đồng bộ ngay** once to rewrite staging warnings and materialize eligible 2026 scores.
