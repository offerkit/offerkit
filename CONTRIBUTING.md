# Contributing

Thanks for helping improve OfferKit. This repo is a pnpm/Turbo monorepo with the web app, worker, public packages, and database schema in one place.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev
pnpm --filter @offerkit/worker dev
```

Run Node 26.7.0 and pnpm 11.20.0, as pinned in the root package. The commands above run
web and worker from local source against the database and Redis containers. To test a
complete image built from source, combine the Compose files:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Documentation

Write user-facing guides under `apps/site/content/next`. Backport corrections to stable
and the applicable version directories when the behavior is shared. Keep examples
consistent with the contract, state the minimum version for new fields, and distinguish
configuration from actions the integrating application must perform. The site README
explains documentation snapshots and validation.

## Quality Gates

Run the checks before opening a PR:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm build
```

GitHub Actions runs the same checks for runtime and package pull requests. Site-only changes are built and deployed by Cloudflare instead. Lefthook installs on `pnpm install` and runs the local pre-commit gate.

## Changesets

Add a changeset when changing a published package:

```bash
pnpm changeset
```

Published packages are `@offerkit/sdk`, `@offerkit/cli`, and `@offerkit/mcp`. Internal packages, the web app, and the worker are ignored by the release workflow.

## Pull Requests

Keep PRs focused and include:

- What changed and why
- Any schema, migration, or deployment impact
- Screenshots or API examples when changing user-facing behavior
- The checks you ran locally
