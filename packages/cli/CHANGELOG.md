# @offerkit/cli

## 0.2.0

### Minor Changes

- 2785e8c: Expose the full OfferKit API surface through MCP and add a generic CLI `api` command that can invoke any SDK procedure by dotted path with JSON input.

## 0.1.6

### Patch Changes

- 2bf459f: Fix CLI login config loading so saved deployment URLs are used unless explicit environment variables override them.

## 0.1.5

### Patch Changes

- 39f20da: Add package README files so npm displays installation, configuration, and usage guidance for each public package.
- 49702f8: Path-bearing SDK procedures now use oRPC's detailed input structure. Pass path values under `params`, request payloads under `body`, and query parameters under `query` for routes such as `vouchers.get({ params: { code } })`, `campaigns.update({ params: { id }, body: { patch } })`, and `referrals.listCodes({ params: { programId }, query: { limit } })`.

  CLI and MCP callers were updated for the detailed contract shape, and `/api/openapi.json` now emits the generated OpenAPI document instead of an empty stub.

- Updated dependencies [39f20da]
- Updated dependencies [49702f8]
  - @offerkit/sdk@0.2.4

## 0.1.4

### Patch Changes

- 6c1a6eb: Publish the updated contract surface for promotions, voucher qualification, and richer redemption failure details in the SDK, and refresh the CLI against the new SDK release.
- Updated dependencies [6c1a6eb]
  - @offerkit/sdk@0.2.3

## 0.1.3

### Patch Changes

- c3a57d2: Rename `tsdown.config.ts` → `tsdown.config.mjs` in sdk/cli/mcp so the CI build doesn't try to load the config via tsdown's TS loader (which requires the optional `unrun` peer dep — present locally, skipped under `pnpm install --frozen-lockfile`). The configs were already pure JS expressions, no TS-specific syntax. No runtime change.
- Updated dependencies [c3a57d2]
  - @offerkit/sdk@0.2.2

## 0.1.2

### Patch Changes

- 0361732: Move dist-pointing `main`/`module`/`types`/`exports`/`bin` fields under `publishConfig` so workspace consumers (apps/web, future integrators using `workspace:*`) resolve to source `./src/index.ts` directly. The published artifact stays unchanged — npm publish overlays the `publishConfig` fields at pack time, so consumers on the registry still get dist files.

  Fixes "Module not found: Can't resolve '@offerkit/sdk'" in apps/web's Next build, which was looking up `packages/sdk/dist/index.mjs` before tsdown had built it.

- Updated dependencies [0361732]
  - @offerkit/sdk@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [ca1805b]
  - @offerkit/sdk@0.2.0
