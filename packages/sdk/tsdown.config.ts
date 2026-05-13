import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { eager: true },
  clean: true,
  platform: "node",
  // Inline @offerkit/contract so the published SDK has no runtime dep on it.
  // Everything else (@orpc/*, zod, node:crypto) stays external.
  deps: {
    alwaysBundle: ["@offerkit/contract"],
    onlyBundle: ["@offerkit/contract"],
  },
});
