import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { eager: true },
  clean: true,
  platform: "node",
  shims: true,
  // Inline @offerkit/contract so the published MCP server has no runtime dep
  // on it. Everything else (@modelcontextprotocol/sdk, @offerkit/sdk, @orpc/*,
  // zod) stays external.
  deps: {
    alwaysBundle: ["@offerkit/contract"],
    onlyBundle: ["@offerkit/contract"],
  },
});
