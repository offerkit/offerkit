import { expect, test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("dashboard renders for the signed-in admin", async ({ page }) => {
    // storageState is wired in playwright.config.ts via globalSetup, so
    // every test starts already authenticated as the seeded admin (with
    // the password-rotation handled once during setup).
    await page.goto("/dashboard");
    // The dashboard shows grouped tile cards and the sidebar nav.
    for (const href of [
      "/customers",
      "/campaigns",
      "/vouchers",
      "/loyalty",
      "/webhooks",
      "/settings",
    ]) {
      await expect(page.locator(`a[href="${href}"] [data-slot="card"]`)).toBeVisible();
    }
  });

  test("campaigns page loads without server errors", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /campaigns/i,
    );
  });
});
