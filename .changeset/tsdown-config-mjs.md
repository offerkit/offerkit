---
"@offerkit/sdk": patch
"@offerkit/cli": patch
"@offerkit/mcp": patch
---

Rename `tsdown.config.ts` → `tsdown.config.mjs` in sdk/cli/mcp so the CI build doesn't try to load the config via tsdown's TS loader (which requires the optional `unrun` peer dep — present locally, skipped under `pnpm install --frozen-lockfile`). The configs were already pure JS expressions, no TS-specific syntax. No runtime change.
