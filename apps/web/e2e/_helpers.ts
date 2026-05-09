import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "changeme123";
// Once smoke.spec.ts has rotated the admin password the seeded password
// stops working. Tests can override with E2E_ADMIN_PASSWORD on subsequent
// runs, or hand the rotated password back via this env var explicitly.
export const ROTATED_PASSWORD =
  process.env["E2E_ADMIN_PASSWORD_ROTATED"] ?? `${ADMIN_PASSWORD}-rotated`;

/**
 * Sign in as the seeded admin and land on the dashboard. Honors the
 * forced change-password step on first boot.
 */
export async function signInAdmin(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  // Try the original seeded password first; if that fails we'll fall
  // back to the rotated one before re-throwing.
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/(dashboard|change-password|sign-in)/, {
    timeout: 15_000,
  });

  if (page.url().includes("/sign-in")) {
    // Seeded password no longer valid — try the rotated one.
    await page.getByLabel(/password/i).fill(ROTATED_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 15_000 });
  }

  if (page.url().includes("/change-password")) {
    await page.getByLabel(/current password/i).fill(ADMIN_PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(ROTATED_PASSWORD);
    await page.getByLabel(/confirm new password/i).fill(ROTATED_PASSWORD);
    await page
      .getByRole("button", { name: /change password|update|save/i })
      .click();
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  }
}

export function uniqueSuffix(): string {
  return `${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}`;
}
