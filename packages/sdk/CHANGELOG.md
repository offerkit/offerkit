# @offerkit/sdk

## 0.2.1

### Patch Changes

- 0361732: Move dist-pointing `main`/`module`/`types`/`exports`/`bin` fields under `publishConfig` so workspace consumers (apps/web, future integrators using `workspace:*`) resolve to source `./src/index.ts` directly. The published artifact stays unchanged — npm publish overlays the `publishConfig` fields at pack time, so consumers on the registry still get dist files.

  Fixes "Module not found: Can't resolve '@offerkit/sdk'" in apps/web's Next build, which was looking up `packages/sdk/dist/index.mjs` before tsdown had built it.

## 0.2.0

### Minor Changes

- ca1805b: Add `externalId` to the customer model, plus two new SDK routes:

  - `customers.upsert({ externalId, email?, name?, … })` — idempotent on `externalId`. Returns `{ customer, created }` so callers can branch on first-vs-subsequent.
  - `customers.getByExternalId({ externalId })` — lookup by integrator-supplied id, returns 404 if not found.

  `customers.create` and `customers.update` now also accept `externalId`. `customerOutput` returns it as `externalId: string | null`.

  This lets integrators stay stateless on their side: pass your own user id as `externalId` and never store the OfferKit-minted UUID. Replaces the email-lookup-then-create pattern that was fragile (substring search, email change handling).
