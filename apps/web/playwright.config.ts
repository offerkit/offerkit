import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: "./e2e/.storage-state.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
