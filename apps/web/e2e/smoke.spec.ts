import { expect, test } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("dashboard renders for the signed-in admin", async ({ page }) => {
    // storageState is wired in playwright.config.ts via globalSetup, so
    // every test starts already authenticated as the seeded admin (with
    // the password-rotation handled once during setup).
    await page.goto("/dashboard");
    // The dashboard shows tile cards (no h1) and the sidebar nav.
    await expect(
      page.getByRole("link", { name: /campaigns/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /customers/i }).first(),
    ).toBeVisible();
  });

  test("campaigns page loads without server errors", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /campaigns/i,
    );
  });
});
