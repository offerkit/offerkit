import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "admin@example.com";
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "changeme123";
const ROTATED_PASSWORD =
  process.env["E2E_ADMIN_PASSWORD_ROTATED"] ?? `${ADMIN_PASSWORD}-rotated`;

/**
 * Sign in once and persist the storage state. Specs reference the file
 * via `use.storageState`, so individual tests start already-authenticated
 * and avoid races on the seeded admin's first-boot password rotation.
 */
async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const stateFile = path.resolve(process.cwd(), "e2e", ".storage-state.json");
  // eslint-disable-next-line no-console
  console.log("[global-setup] writing storage state to", stateFile);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/sign-in");

  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/sign-in/email"),
      { timeout: 15_000 },
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);
  // Give the client router a beat to push to the next route.
  await page.waitForLoadState("networkidle", { timeout: 15_000 });

  // If the seeded password was rejected (e.g. a previous run already
  // rotated it), fall back to the rotated password.
  if (page.url().includes("/sign-in")) {
    await page.getByLabel(/password/i).fill(ROTATED_PASSWORD);
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/auth/sign-in/email"),
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  }

  if (page.url().includes("/change-password")) {
    await page.getByLabel(/current password/i).fill(ADMIN_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(ROTATED_PASSWORD);
    await page.getByLabel(/confirm new password/i).fill(ROTATED_PASSWORD);
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/auth/change-password"),
        { timeout: 15_000 },
      ),
      page
        .getByRole("button", {
          name: /change password|update password|update|save/i,
        })
        .click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // revokeOtherSessions:true on the change-password call can invalidate
    // the current session. If we're bounced to /sign-in, sign back in
    // with the new password before persisting state.
    if (page.url().includes("/sign-in")) {
      await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
      await page.getByLabel(/password/i).fill(ROTATED_PASSWORD);
      await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/api/auth/sign-in/email"),
          { timeout: 15_000 },
        ),
        page.getByRole("button", { name: /sign in/i }).click(),
      ]);
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
    }
  }

  // eslint-disable-next-line no-console
  console.log("[global-setup] final url before save:", page.url());
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await ctx.storageState({ path: stateFile });
  await browser.close();
  // eslint-disable-next-line no-console
  console.log("[global-setup] state saved");
}

export default globalSetup;
