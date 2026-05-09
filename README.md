# offerkit

Self-hostable, MIT-licensed open-source alternative to Voucherify. Promotion engine: coupons, discounts, gift cards, loyalty programs, referrals, customer segments, validation rules. Surfaces: dashboard + REST API + TypeScript SDK + CLI + MCP server.

> **Status:** v1.0 in active development. Phase 1 (foundation) is complete: monorepo, auth, DB schema, observability, worker queue, embedded docs site, oRPC + OpenAPI surface. Promotion features land in Phase 2+.

## Quick start (local dev)

Requirements: Docker.

```bash
cp .env.example .env
docker compose up
```

Then open <http://localhost:3000> and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`. You'll be prompted to change the password on first sign-in.

## Quick start (Node + pnpm)

Requirements: Node 24+, pnpm 10+, a running Postgres.

```bash
pnpm install
cp .env.example .env  # edit DATABASE_URL etc.
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev          # web on :3000
pnpm --filter @offerkit/worker dev       # worker on :9091
```

## Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)

The repo ships a `railway.toml` with a `web` service (Dockerfile builder, healthcheck `/api/v1/ready`) and a `worker` service. Provision a Postgres in the same Railway project; reference its `DATABASE_URL` into both services.

## Repo layout

```
apps/web         Next.js dashboard + REST API + /docs (Fumadocs embedded)
apps/worker      Long-running Node process — runs the Postgres job queue
packages/contract  oRPC router contract + Zod schemas (single source of truth)
packages/core    Domain logic (rules, redemption, discount, jobs, observability, email)
packages/db      Drizzle schema + client + migrations
packages/sdk     @offerkit/sdk — typed TS client
packages/cli     @offerkit/cli — `offerkit` CLI
packages/mcp     @offerkit/mcp — MCP server (stdio + http)
packages/ui      Shared UI primitives
packages/config  ESLint + TS + Tailwind shared configs
```

## Quality gate

No CI. Local-only enforcement via [lefthook](https://github.com/evilmartians/lefthook):

```bash
pnpm install            # auto-runs `lefthook install`
git commit              # pre-commit runs eslint + typecheck + fallow + test
```

## Stack

Next.js 16 (App Router) · React 19 · Postgres 17 · Drizzle ORM · Better Auth · oRPC · gt-next (i18n runtime) · Fumadocs (embedded at `/docs`) · OpenTelemetry · Tailwind v4 · shadcn/ui · TypeScript strict · MIT license throughout.

## License

[MIT](./LICENSE)
