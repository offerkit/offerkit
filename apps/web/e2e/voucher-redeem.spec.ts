import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "./_helpers";

test.describe("voucher redeem from dashboard", () => {
  test("create campaign + voucher → run test redemption → success toast appears", async ({
    page,
  }) => {
    // Create a campaign through the UI so we have a known starting point.
    const campaignName = `e2e-redeem-${uniqueSuffix()}`;
    await page.goto("/campaigns/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name", { exact: true }).fill(campaignName);
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

    // Bulk-mint 1 voucher from the campaign detail page; click into the
    // voucher's detail row to land on /vouchers/[code].
    await page.getByLabel(/bulk generate/i).fill("1");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/v1/vouchers/bulk") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /generate codes/i }).click(),
    ]);

    // The voucher table now has one row. Click its code link to land on
    // /vouchers/[code]. Filter to the link that points at /vouchers/{code}.
    const voucherLink = page.locator(
      "a[href^='/vouchers/']:not([href='/vouchers']):not([href*='/vouchers/new'])",
    );
    await voucherLink.first().click();
    await page.waitForURL(/\/vouchers\/[A-Za-z0-9]+$/, { timeout: 15_000 });

    // Run the test redemption form. Bulk-minted vouchers carry no
    // discount jsonb, but the redeem call still returns ok=true (the
    // discount math just yields 0).
    await page.getByLabel(/order amount/i).fill("5000");
    await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/api\/v1\/vouchers\/[^/]+\/redemption$/.test(r.url()) &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /^redeem$/i }).click(),
    ]);
    await expect(
      page.getByText(/redemption succeeded/i).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
