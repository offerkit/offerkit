import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "admin@example.com";
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "changeme123";

test.describe("dashboard smoke", () => {
  test("admin can sign in and see the dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // First boot of the seeded admin must change password. Honor the
    // forced redirect by setting a new one and continuing.
    await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 15_000 });
    if (page.url().includes("/change-password")) {
      const fresh = `${ADMIN_PASSWORD}-rotated`;
      await page.getByLabel(/current password/i).fill(ADMIN_PASSWORD);
      await page.getByLabel("New password", { exact: true }).fill(fresh);
      await page.getByLabel(/confirm new password/i).fill(fresh);
      await page.getByRole("button", { name: /change password|update|save/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    }

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /campaigns/i })).toBeVisible();
  });

  test("campaigns page loads without server errors", async ({ page, context }) => {
    // Reuses the storage state from the previous test in serial mode.
    await page.goto("/campaigns");
    if (page.url().includes("/sign-in")) {
      test.skip(true, "first test must succeed to provide a session");
    }
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/campaigns/i);
    void context;
  });
});
