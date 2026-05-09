import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Live-DB tests in src/redemption share a memoized migration via
    // _test-db.ts; running test files in separate workers would race
    // on `drizzle` schema creation. Single-threaded execution keeps
    // the shared cache load-bearing without slowing the unit tests
    // measurably.
    fileParallelism: false,
  },
});
