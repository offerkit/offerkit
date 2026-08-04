# OfferKit public site

The public OfferKit website, built with Astro and Fumadocs and configured for `https://offerkit.dev`.

## Routes

- `/` is the marketing homepage.
- `/blog` contains repository-backed product and engineering articles.
- `/docs` serves the latest stable documentation.
- `/docs/next` tracks unreleased changes on `main` and is excluded from indexing.
- `/docs/v/<major.minor>` preserves a release line, starting with `/docs/v/0.1`.

Blog posts live in `content/blog`. Stable, unreleased, and archived documentation lives in `content/docs`, `content/next`, and `content/versions` respectively.

## Documentation releases

Product changes should be documented in `content/next`. Corrections that also apply to a supported release should be backported to `content/docs` and the relevant directory under `content/versions`.

Before releasing a new product version, promote `next` and create its minor-version snapshot:

```bash
pnpm --filter @offerkit/site snapshot 0.2.0
```

Commit the generated stable snapshot and `versions.json` update as part of the release pull request. The image release workflow checks that the requested release line has been promoted before it creates a tag.

## Local development

From the repository root:

```bash
pnpm --filter @offerkit/site dev
```

The site runs at `http://localhost:4321` by default.

## Validation

```bash
pnpm --filter @offerkit/site lint
pnpm --filter @offerkit/site typecheck
pnpm --filter @offerkit/site build
```

## Deploy to Cloudflare

Connect the repository directly in Cloudflare Workers Builds and use these settings:

- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm --filter @offerkit/site build`
- Deploy command: `pnpm --filter @offerkit/site exec wrangler deploy`
- Optional preview deploy command: `pnpm --filter @offerkit/site exec wrangler versions upload`
- Build watch paths: `apps/site/**`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`

Keeping the root directory at the repository root lets Cloudflare install the pnpm workspace from the shared lockfile. The filtered deploy command runs Wrangler from `apps/site`.

`wrangler.jsonc` attaches `offerkit.dev` and serves the generated Astro site as static assets. The hostname must be available in the connected Cloudflare zone without a conflicting DNS record.

Cloudflare owns the Git integration and deploy pipeline, so no site deployment workflow or GitHub Actions secrets are required.

For a manual deployment, authenticate Wrangler locally and run:

```bash
pnpm --filter @offerkit/site deploy
```
