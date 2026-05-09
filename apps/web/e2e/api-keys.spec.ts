import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./_helpers";

test.describe("API keys settings", () => {
  test("mint key → one-time token banner shows → dismiss → key visible in list", async ({
    page,
  }) => {
    const keyName = `e2e-key-${uniqueSuffix()}`;
    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");

    await page.locator("#key-name").fill(keyName);
    const mint = page.getByRole("button", { name: /mint key/i });
    await expect(mint).toBeEnabled();
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/api-keys") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      mint.click(),
    ]);

    // One-time banner shows: a readonly token field whose value starts
    // with `offerkit_` plus a Dismiss button.
    const tokenInput = page.locator("input[value^='offerkit_']");
    await expect(tokenInput).toBeVisible({ timeout: 15_000 });
    const dismiss = page.getByRole("button", { name: /dismiss/i });
    await dismiss.click();
    await expect(tokenInput).toBeHidden();

    // Key is in the active list; the row is identified by its name cell.
    await expect(page.getByRole("cell", { name: keyName })).toBeVisible({
      timeout: 15_000,
    });
  });
});
