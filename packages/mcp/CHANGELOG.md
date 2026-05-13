# @offerkit/mcp

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
