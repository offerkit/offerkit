import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./_helpers";

test.describe("campaign wizard", () => {
  test("create new campaign → bulk-mint 5 codes → list shows them", async ({
    page,
  }) => {
    const name = `e2e-camp-${uniqueSuffix()}`;
    await page.goto("/campaigns/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill(name);

    const submit = page.getByRole("button", { name: /create campaign/i });
    await expect(submit).toBeEnabled();
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/campaigns") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      submit.click(),
    ]);
    await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(name);

    // Bulk-mint 5 codes from the in-page form.
    await page.getByLabel(/bulk generate/i).fill("5");
    await page
      .getByRole("button", { name: /generate codes/i })
      .click();

    // 5 voucher rows show up. Codes are random; count data rows by their
    // role within the vouchers table (header row excluded).
    await expect(page.getByRole("row")).toHaveCount(6, { timeout: 15_000 });
  });
});
