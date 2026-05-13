# @offerkit/mcp

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
