import { describe, expect, it } from "vitest";
import { checkCampaignActivation } from "./shared.ts";

describe("campaign activation", () => {
  it("fails closed when a voucher references a campaign that was not loaded", () => {
    expect(
      checkCampaignActivation(
        undefined,
        "00000000-0000-4000-8000-000000000001",
        "USD",
        new Date(),
      ),
    ).toBe("campaign_inactive");
  });

  it("allows vouchers that do not belong to a campaign", () => {
    expect(checkCampaignActivation(undefined, null, "USD", new Date())).toBeNull();
  });
});
