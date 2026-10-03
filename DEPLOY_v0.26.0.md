# Deploy v0.26.0

1. Back up the PostgreSQL/Neon database.
2. Run all of `sql/upgrade_v0.26.0.sql`.
3. Deploy the application with `npm ci` and `npm start`.
4. Run `npm test` in the configured test environment before release.
5. Sign in as each teacher and enter optional Facebook, Messenger, and Zalo HTTPS links at `/teacher/social-links`.
6. Confirm that the linked teacher contact buttons appear in the parent portal header and that the score summary contains only positive numeric scores.

The migration is additive and safe to rerun. No environment variables are added.