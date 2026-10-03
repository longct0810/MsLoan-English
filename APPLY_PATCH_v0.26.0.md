# Apply Patch v0.26.0

Upgrade from v0.25.5 to v0.26.0.

1. Deploy the updated application.
2. Run `sql/upgrade_v0.26.0.sql` on PostgreSQL/Neon.
3. Run `npm test` before committing or deploying to production.

The SQL migration is safe to rerun. It adds the teacher social link table and recalculates persisted averages to exclude zero and negative status values. See `DEPLOY_v0.26.0.md` for rollout checks.