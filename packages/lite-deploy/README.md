# @mmldigi/forms-lite-deploy

Lite-edition deployment entry for `@mmldigi/forms-core`.

This is the package you `wrangler deploy` to your own Cloudflare account
if you want to self-host the form backend without the Pro plugins.

## Local development

```bash
# from monorepo root
pnpm install
pnpm --filter @mmldigi/forms-lite-deploy db:migrate:local
pnpm --filter @mmldigi/forms-lite-deploy dev
```

Server starts on `http://localhost:8788`.

Quick smoke test:
```bash
curl http://localhost:8788/api/v1/health
curl http://localhost:8788/api/v1/forms/contact/schema
curl -X POST http://localhost:8788/api/v1/forms/contact/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {"name": "Test", "email": "t@t.com", "message": "hi"},
    "context": {"page_url": "http://test.com"},
    "_meta": {"honeypot": "", "time_on_form_ms": 5000}
  }'
```

## Production deployment

1. Copy `wrangler.toml.template` to `wrangler.toml`
2. Replace `{TENANT}` placeholders with your tenant name
3. Run:
   ```bash
   wrangler d1 create forms-{tenant}              # copy ID into wrangler.toml
   wrangler kv:namespace create forms-{tenant}-ratelimit  # copy ID into wrangler.toml
   wrangler pages project create forms-{tenant}
   pnpm --filter @mmldigi/forms-lite-deploy db:migrate:remote
   pnpm --filter @mmldigi/forms-lite-deploy deploy
   ```

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/health` | public |
| GET | `/api/v1/forms/:id/schema` | public |
| POST | `/api/v1/forms/:id/submissions` | public |

Admin endpoints (list/export/edit-schema) come in Phase 1c.
