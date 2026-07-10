import { describe, expectTypeOf, it } from "vitest";
import type { ApiListItem, ApiResult, OfferKitClient } from "./sdk";

describe("dashboard SDK type helpers", () => {
  it("infers list rows from the typed SDK response", () => {
    type CampaignList = ApiResult<OfferKitClient["campaigns"]["list"]>;
    type CampaignRow = ApiListItem<OfferKitClient["campaigns"]["list"]>;

    expectTypeOf<CampaignRow>().toEqualTypeOf<CampaignList["data"][number]>();
    expectTypeOf<CampaignRow["id"]>().toEqualTypeOf<string>();
  });

  it("preserves nested detail and summary row types", () => {
    type Order = ApiResult<OfferKitClient["orders"]["get"]>;
    type Insights = ApiResult<OfferKitClient["insights"]["summary"]>;

    expectTypeOf<Order["items"][number]["unitPrice"]>().toEqualTypeOf<number>();
    expectTypeOf<Insights["topCampaigns"][number]["redemptions"]>().toEqualTypeOf<number>();
    expectTypeOf<Insights["webhooks"][number]["status"]>().toEqualTypeOf<
      "pending" | "succeeded" | "failed" | "dead"
    >();
  });
});
