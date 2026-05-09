import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Live-DB e2e tests under flows/ share a memoized pg pool via
    // _helpers.getTestDb. Sequential file execution keeps the cache
    // load-bearing and avoids races on drizzle migrations.
    fileParallelism: false,
  },
});
