<p align="center">
  <img src=".github/assets/offerkit-readme-header-text.png" alt="OfferKit promotion engine dashboard illustration" width="800" />
</p>

<h1 align="center">OfferKit</h1>

<p align="center">
  <strong>Agent-first, dev-friendly, open-source promotion engine you self-host.</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/offerkit/offerkit?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/offerkit/offerkit/stargazers"><img src="https://img.shields.io/github/stars/offerkit/offerkit?style=flat-square" alt="GitHub stars" /></a>
  <a href="https://github.com/offerkit/offerkit/network/members"><img src="https://img.shields.io/github/forks/offerkit/offerkit?style=flat-square" alt="GitHub forks" /></a>
</p>

<p align="center">
  <a href="#-why-offerkit">Why OfferKit</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-self-host">Self-Host</a> ·
  <a href="#-sdk-cli-mcp">SDK, CLI, MCP</a> ·
  <a href="#-docs">Docs</a> ·
  <a href="#-license">License</a>
</p>

OfferKit is open-source promotion infrastructure for coupons, gift cards, loyalty, referrals, customer segments, and validation rules. It ships with a dashboard, REST API, TypeScript SDK, CLI, and MCP server, and runs from one Docker image for self-hosted deployments.

## 🤖 Why OfferKit

**Agent-first.** The MCP server is a first-class surface, not bolted on. Every mutating endpoint declares its risk level (`safe` / `mutating` / `destructive`) so LLM hosts can render the right confirmation. New procedures opt into MCP exposure declaratively via `.meta()` — no separate package to update.

**Dev-friendly.** The typed SDK is derived directly from the oRPC contract, so client types stay in lockstep with the server with zero codegen. Strict TypeScript, linted against explicit `any`, with typed contracts at API boundaries. The `/docs` site lives inside the app (Fumadocs). Local-first dev with Docker compose, plus CI and lefthook quality gates.

**Open source.** MIT-licensed first-party packages. No CLA required. No commercial features paywalled. Built on top of permissive OSS.

**Self-hostable.** One `docker compose up` brings up web + worker + Postgres + Redis from `ghcr.io/offerkit/offerkit`. Railway uses the same published image for both services; no GitHub source deploy required. OpenTelemetry-ready out of the box for any OTLP backend.

## ✨ Features

- 🎟️ Discount engine — fixed-amount, percentage, with optional caps, scoped to products or collections
- 🧾 Stackable redemptions — apply N codes to one order atomically, all-or-nothing
- 💳 Gift cards — full ledger, partial spend, atomic rollback
- 🏆 Loyalty — programs, tiers, earning rules, points ledger, expiration
- 👥 Referrals — `{PREFIX}-{code}` codes, dual-reward conversions
- 🧩 Customer segments — JSON Logic rules with live preview
- ✅ Validation rules — debuggable, traceable; tested on every redemption
- ⚙️ Background jobs — Redis/BullMQ by default, with a Postgres fallback when Redis is not configured
- 🔭 Observability — OpenTelemetry traces, metrics, logs out of the box
- 🔐 Audit log — every mutation with actor, before/after, IP, user agent
- 🤖 MCP server — declaratively-exposed tools with risk-level metadata
- 📜 MIT — first-party packages throughout the monorepo

## 🚀 Quick Start

Requires Docker.

```bash
git clone https://github.com/offerkit/offerkit.git
cd offerkit
cp .env.example .env
docker compose up
```

Visit <http://localhost:3000> and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. The example defaults work locally; edit them before deploying. The first sign-in forces a password change.

## 🏠 Self-Host

### Docker compose

The `docker-compose.yml` brings up `web` + `worker` + `postgres` + `redis`. Both runtime services use the same published image, `ghcr.io/offerkit/offerkit`. Migrations run automatically on web boot. Background jobs use Redis/BullMQ when `REDIS_URL` is set, with a Postgres fallback otherwise. See [`/docs/self-host`](apps/web/content/docs/self-host.mdx) for env vars and tuning.

### Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/offerkit?referralCode=IxSuAK)

In one Railway project, create Postgres and Redis, then create two Docker Image services from `ghcr.io/offerkit/offerkit:latest`. `latest` is fine for evaluation; production deployments should pin a release tag. The public `web` service uses the default command. The private `worker` service overrides the command to `node apps/worker/dist/index.js` and should not have a public domain. Reference Postgres's `DATABASE_URL` and Redis's `REDIS_URL` into both app services. Set `BETTER_AUTH_SECRET`, `OFFERKIT_PUBLIC_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` on the `web` service.

### Diploi

[![Launch with Diploi](https://diploi.com/launch-big.svg)](https://diploi.com/launch/akshitkrnagpal/offerkit)

Create one Diploi project with a public `web` component, a private `worker` component, Postgres, and Redis. Use the same published image, `ghcr.io/offerkit/offerkit:latest`, for both components. `latest` is fine for evaluation; production deployments should pin a release tag. The worker command is `node apps/worker/dist/index.js`. Wire Postgres's `DATABASE_URL` and Redis's `REDIS_URL` into both components. Set `BETTER_AUTH_SECRET`, `OFFERKIT_PUBLIC_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` on `web`; set `WORKER_HEALTH_PORT=9091` on `worker`.

## 📦 SDK, CLI, MCP

### TypeScript SDK

```bash
pnpm add @offerkit/sdk
```

```ts
import { createClient } from "@offerkit/sdk";

const client = createClient({
  baseUrl: "https://your-offerkit-deployment",
  apiKey: process.env.OFFERKIT_API_KEY!,
});

const result = await client.vouchers.redeem({
  code: "SUMMER10",
  order: { amount: 9999, currency: "USD" },
});
```

### CLI

```bash
pnpm add -g @offerkit/cli
offerkit login --url https://your-offerkit-deployment --api-key offerkit_…
offerkit vouchers list
offerkit vouchers redeem SUMMER10 --amount 9999
```

### MCP server

```jsonc
{
  "mcpServers": {
    "offerkit": {
      "command": "npx",
      "args": ["-y", "@offerkit/mcp"],
      "env": {
        "OFFERKIT_API_URL": "https://your-offerkit-deployment",
        "OFFERKIT_API_KEY": "offerkit_…"
      }
    }
  }
}
```

## 🏗️ Development

Requires Node 24+, pnpm 10+, running Postgres, and Redis.

```bash
pnpm install
cp .env.example .env             # edit DATABASE_URL etc.
docker compose up -d postgres redis
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev          # web on :3000
pnpm --filter @offerkit/worker dev       # worker on :9091
```

To test the production image shape from local source:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

```
apps/web         Next.js dashboard + REST API + /docs (Fumadocs embedded)
apps/worker      Long-running Node process — runs the Redis/BullMQ job queue
packages/contract  oRPC router contract + Zod schemas (single source of truth)
packages/core    Domain logic (rules, redemption, discount, jobs, observability, email)
packages/db      Drizzle schema + client + migrations
packages/sdk     @offerkit/sdk — typed TS client
packages/cli     @offerkit/cli — `offerkit` CLI
packages/mcp     @offerkit/mcp — MCP server (stdio + http)
packages/ui      Shared UI primitives
packages/config  ESLint + TS + Tailwind shared configs
```

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

## 🛠️ Built With

- **Next.js 16** (App Router, React 19) — dashboard + REST API
- **Postgres 17** + **Drizzle ORM** — schema, migrations, typed client
- **Redis** + **BullMQ** — default background job queue
- **Better Auth** — sessions for the dashboard, API keys for programmatic access
- **oRPC** + **Zod** — single contract for RPC, REST, and OpenAPI
- **Tailwind v4** + **shadcn/ui** — dashboard UI
- **gt-next** — i18n runtime
- **Fumadocs** — `/docs` embedded in the app
- **OpenTelemetry** — traces, metrics, logs
- **TypeScript** strict, **MIT** first-party packages

## ✅ Quality Gates

Pull requests and pushes to `main` run typecheck, lint, tests, and production build in GitHub Actions. Local commits also run the same checks through [lefthook](https://github.com/evilmartians/lefthook):

```bash
pnpm install            # auto-runs `lefthook install`
git commit              # pre-commit runs eslint + typecheck + test
```

## 📖 Docs

The full reference lives inside the app at <http://localhost:3000/docs> (Fumadocs-rendered). Source MDX at [`apps/web/content/docs/`](apps/web/content/docs/).

## 🤝 Contributing

1. Fork and branch off `main`
2. `pnpm install` (hooks auto-install)
3. Make your change; the lefthook pre-commit gate runs eslint + typecheck + test
4. Open a PR

No CLA required.

## 📄 License

[MIT](./LICENSE)

## 🙏 Acknowledgments

Built on top of [Next.js](https://nextjs.org/), [Drizzle ORM](https://orm.drizzle.team/), [Better Auth](https://better-auth.com/), [oRPC](https://orpc.dev/), [Fumadocs](https://fumadocs.dev/), [gt-next](https://generaltranslation.com/), and the rest of the OSS world.
