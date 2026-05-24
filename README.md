# @mmldigi/forms-core

B2B inquiry form widget — embeddable Web Component + serverless backend on Cloudflare.

> ⚠️ Pre-1.0. Plugin API may change between minor versions until 1.0.

## What this is

A self-deployable form backend that:
- Stores inquiries in **your** Cloudflare D1
- Accepts submissions via a JSON-Schema-driven form widget (Phase 1b)
- Forwards each inquiry to your inbox (Phase 1c)
- Pushes to any HTTP webhook (企业微信/钉钉 bot, Slack, Zapier, your CRM) (Phase 1c)
- Provides a minimal admin UI for browsing/exporting (Phase 1c)

The Pro edition (proprietary, hosted by mmldigi) adds:
- Visitor journey tracking
- IP → company resolution
- Lead scoring integration
- Feishu Bitable two-way sync
- Rich analytics dashboard
- GTM events with conversion values per node

## Architecture

```
forms-core/          ← this repo (public, MIT)
├── packages/core/         core API + plugin hooks + DB layer
└── packages/lite-deploy/  CF Pages Functions entry (deploy this)
```

Pro plugins live in a separate private repo (`forms-pro`) and overlay on top
of `@mmldigi/forms-core` via the plugin hook system.

## Quick start (local development)

```bash
# Prereqs: pnpm 9+, Node 20+, wrangler CLI
pnpm install
pnpm --filter @mmldigi/forms-lite-deploy db:migrate:local
pnpm --filter @mmldigi/forms-lite-deploy dev
# → http://localhost:8788
```

Smoke test:
```bash
curl http://localhost:8788/api/v1/health
```

See `packages/lite-deploy/README.md` for production deployment.

## Project status

- [x] **Phase 1a** Foundation (this plan)
- [ ] Phase 1b Web Component + theming
- [ ] Phase 1c Email + webhook + admin UI
- [ ] Phase 2 Pro plugins
- [ ] Phase 3 Production hardening (canary CI, migration tool)

## License

MIT
