## Local development

Copy `.env.example` to `.env.local` and fill in local values. Never commit `.env`
or `.env.local`; configure production variables in the hosting platform instead.

When Supabase is reachable, start the API normally:

```bash
uv run fastapi dev src/main.py
```

If Supabase DNS or connectivity is unavailable, use the local SQLite development database:

```bash
USE_LOCAL_DB=true uv run fastapi dev src/main.py
```

Local mode creates `local.db` in the backend directory. Production continues to use `DATABASE_URL` unless `USE_LOCAL_DB=true` is explicitly set.
