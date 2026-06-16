import { describe, expect, it } from "vitest";
import { failureExplanation, stackBreakdownExplanations } from "./explanations.ts";
import type { VoucherRow } from "./types.ts";

const baseVoucher: VoucherRow = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "SAVE10",
  campaignId: null,
  type: "DISCOUNT",
  discount: { type: "AMOUNT", amount: 500 },
  customRewards: [],
  giftBalance: null,
  redemptionLimit: 1,
  perUserRedemptionLimit: null,
  redemptionCount: 1,
  active: true,
  startDate: null,
  endDate: null,
  customerId: null,
  priority: 0,
  exclusive: false,
  deletedAt: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

describe("redemption explanations", () => {
  it("returns safe structured details for redemption limit failures", () => {
    const explanation = failureExplanation("redemption_limit_reached", baseVoucher);

    expect(explanation).toMatchObject({
      code: "redemption_limit_reached",
      message: "Voucher has reached its redemption limit",
      voucherId: baseVoucher.id,
      voucherCode: "SAVE10",
      details: { redemptionCount: 1, redemptionLimit: 1 },
    });
  });

  it("turns stacking skips into support-friendly explanations", () => {
    const explanations = stackBreakdownExplanations([
      { voucherId: baseVoucher.id, code: "SAVE10", amount: 0, reason: "exclusivity_lost" },
      { voucherId: "00000000-0000-4000-8000-000000000002", code: "VIP", amount: 500, type: "AMOUNT" },
    ]);

    expect(explanations).toEqual([
      {
        code: "exclusivity_lost",
        message: "Voucher skipped because an exclusive voucher was applied",
        voucherId: baseVoucher.id,
        voucherCode: "SAVE10",
        details: { amount: 0 },
      },
    ]);
  });
});
