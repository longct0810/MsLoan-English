# English Classroom v0.20.2

Hotfix for student persistence. No database migration is required from v0.20.1.

Before restart on the real deployment, ensure:

```env
NODE_ENV=production
DEMO_MODE=false
SHOW_DEMO_ACCOUNTS_ON_LOGIN=false
```

Students created while DEMO_MODE was true existed only in process memory and must be created again after switching to PostgreSQL mode.
