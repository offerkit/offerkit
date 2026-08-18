import { describe, expect, it } from "vitest";
import { previewDiscount, previewGiftCard } from "./shared.ts";
import type { VoucherRow } from "./types.ts";

const voucher: VoucherRow = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "MONEY",
  campaignId: null,
  type: "DISCOUNT",
  discount: { type: "AMOUNT", amount: 500 },
  customRewards: [],
  giftBalance: null,
  redemptionLimit: null,
  perUserRedemptionLimit: null,
  redemptionCount: 0,
  active: true,
  startDate: null,
  endDate: null,
  customerId: null,
  priority: 0,
  exclusive: false,
  deletedAt: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

describe("orderless redemption previews", () => {
  it("uses the supplied workspace currency for discounts", () => {
    expect(previewDiscount(voucher, undefined, "EUR").finalOrder).toEqual({
      amount: 0,
      currency: "EUR",
    });
  });

  it("uses the supplied workspace currency for gift cards", () => {
    const preview = previewGiftCard(
      { ...voucher, type: "GIFT_CARD", discount: null, giftBalance: 1_000 },
      undefined,
      "AED",
    );

    expect(preview?.finalOrder).toEqual({ amount: 0, currency: "AED" });
  });
});
