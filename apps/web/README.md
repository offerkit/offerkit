# OfferKit web

The Next.js dashboard and API server for OfferKit.

## Development

From the repository root, install dependencies and configure the local environment:

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev
```

The app runs at `http://localhost:3000`. The separate public site workspace runs with `pnpm --filter @offerkit/site dev`; its documentation is published at <https://offerkit.dev/docs>.

## Checks

```bash
pnpm --filter @offerkit/web lint
pnpm --filter @offerkit/web typecheck
pnpm --filter @offerkit/web test
pnpm --filter @offerkit/web build
```
