import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  platform: "node",
  shims: true,
  dts: false,
  outExtensions: () => ({ js: ".js" }),
  deps: {
    alwaysBundle: [/^@offerkit\//],
    onlyBundle: false,
  },
});
