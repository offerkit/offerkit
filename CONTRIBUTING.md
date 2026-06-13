# Contributing

Thanks for helping improve OfferKit. This repo is a pnpm/Turbo monorepo with the web app, worker, public packages, and database schema in one place.

## Setup

```bash
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev
pnpm --filter @offerkit/worker dev
```

## Quality Gates

Run the checks before opening a PR:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm build
```

GitHub Actions runs the same checks on pull requests. Lefthook installs on `pnpm install` and runs the local pre-commit gate.

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
