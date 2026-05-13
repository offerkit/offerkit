import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { eager: true },
  clean: true,
  platform: "node",
  // Preserve the #!/usr/bin/env node shebang on the bundled bin.
  shims: true,
});
