import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateDiscount, type DiscountVoucher } from "./index.ts";

const order = (amount: number, currency = "USD") => ({ amount, currency, items: [] });

describe("calculateDiscount — golden cases", () => {
  it("applies a flat $10 off", () => {
    const result = calculateDiscount({
      order: order(10000),
      vouchers: [{ id: "v1", code: "TEN", type: "AMOUNT", amount: 1000 }],
    });
    expect(result.finalOrder.amount).toBe(9000);
    expect(result.appliedDiscounts).toEqual([
      { voucherId: "v1", code: "TEN", amount: 1000, type: "AMOUNT" },
    ]);
  });

  it("applies a 20% discount", () => {
    const result = calculateDiscount({
      order: order(10000),
      vouchers: [{ id: "v1", code: "TWENTY", type: "PERCENTAGE", percent: 2000 }],
    });
    expect(result.finalOrder.amount).toBe(8000);
    expect(result.appliedDiscounts[0]?.amount).toBe(2000);
  });

  it("respects maxDiscountAmount on a percentage", () => {
    const result = calculateDiscount({
      order: order(100_00),
      vouchers: [
        { id: "v1", code: "HALF", type: "PERCENTAGE", percent: 5000, maxDiscountAmount: 1000 },
      ],
    });
    expect(result.appliedDiscounts[0]?.amount).toBe(1000);
    expect(result.finalOrder.amount).toBe(9000);
  });

  it("clamps order at zero — no negative totals", () => {
    const result = calculateDiscount({
      order: order(500),
      vouchers: [{ id: "v1", code: "BIG", type: "AMOUNT", amount: 9999 }],
    });
    expect(result.finalOrder.amount).toBe(0);
    expect(result.appliedDiscounts[0]?.amount).toBe(500);
  });

  it("stacks discounts in priority order (post-discount running total)", () => {
    const result = calculateDiscount({
      order: order(10000),
      vouchers: [
        { id: "v1", code: "A", type: "AMOUNT", amount: 1000, priority: 10 },
        { id: "v2", code: "B", type: "PERCENTAGE", percent: 1000, priority: 1 }, // 10% on remaining
      ],
    });
    // priority=10 first: $10 off → 9000; then 10% off → 900 off → final 8100
    expect(result.appliedDiscounts.map((a) => a.amount)).toEqual([1000, 900]);
    expect(result.finalOrder.amount).toBe(8100);
  });

  it("exclusive voucher short-circuits others", () => {
    const result = calculateDiscount({
      order: order(10000),
      vouchers: [
        { id: "v1", code: "A", type: "AMOUNT", amount: 1000 },
        { id: "v2", code: "B", type: "PERCENTAGE", percent: 5000, exclusive: true },
      ],
    });
    expect(result.appliedDiscounts).toHaveLength(1);
    expect(result.appliedDiscounts[0]?.code).toBe("B");
    expect(result.finalOrder.amount).toBe(5000);
    expect(
      result.breakdown.find((b) => b.code === "A" && "reason" in b && b.reason === "exclusivity_lost"),
    ).toBeDefined();
  });

  it("skips a voucher whose effective discount is zero on a $0 running total", () => {
    const result = calculateDiscount({
      order: order(1000),
      vouchers: [
        { id: "v1", code: "A", type: "AMOUNT", amount: 1000 },
        { id: "v2", code: "B", type: "PERCENTAGE", percent: 1000 },
      ],
    });
    expect(result.appliedDiscounts).toHaveLength(1);
    expect(result.finalOrder.amount).toBe(0);
    const skipped = result.breakdown.find((b) => b.code === "B");
    expect(skipped && "reason" in skipped ? skipped.reason : null).toBe(
      "zero_after_running_total",
    );
  });

  it("rejects a negative order amount", () => {
    expect(() =>
      calculateDiscount({ order: order(-1), vouchers: [] }),
    ).toThrow();
  });
});

describe("calculateDiscount — property-based invariants", () => {
  const voucherArb = fc.record({
    id: fc.uuid(),
    code: fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[A-Z0-9]+$/.test(s)),
    type: fc.constantFrom<"AMOUNT" | "PERCENTAGE">("AMOUNT", "PERCENTAGE"),
    amount: fc.integer({ min: 0, max: 100_000 }),
    percent: fc.integer({ min: 0, max: 10_000 }),
    priority: fc.integer({ min: 0, max: 100 }),
    exclusive: fc.boolean(),
  });
  const orderArb = fc.record({
    amount: fc.integer({ min: 0, max: 1_000_000 }),
    currency: fc.constantFrom("USD", "EUR", "GBP"),
  });

  it("final amount is always >= 0", () => {
    fc.assert(
      fc.property(orderArb, fc.array(voucherArb, { maxLength: 6 }), (o, vs) => {
        const result = calculateDiscount({
          order: { ...o, items: [] },
          vouchers: vs as DiscountVoucher[],
        });
        return result.finalOrder.amount >= 0;
      }),
    );
  });

  it("sum of applied discounts equals order.amount - finalOrder.amount", () => {
    fc.assert(
      fc.property(orderArb, fc.array(voucherArb, { maxLength: 6 }), (o, vs) => {
        const result = calculateDiscount({
          order: { ...o, items: [] },
          vouchers: vs as DiscountVoucher[],
        });
        const sum = result.appliedDiscounts.reduce((acc, a) => acc + a.amount, 0);
        return sum === o.amount - result.finalOrder.amount;
      }),
    );
  });

  it("is deterministic given the same input", () => {
    fc.assert(
      fc.property(orderArb, fc.array(voucherArb, { maxLength: 6 }), (o, vs) => {
        const a = calculateDiscount({
          order: { ...o, items: [] },
          vouchers: vs as DiscountVoucher[],
        });
        const b = calculateDiscount({
          order: { ...o, items: [] },
          vouchers: vs as DiscountVoucher[],
        });
        return JSON.stringify(a) === JSON.stringify(b);
      }),
    );
  });

  it("is order-independent (sort happens internally)", () => {
    fc.assert(
      fc.property(orderArb, fc.array(voucherArb, { maxLength: 6 }), (o, vs) => {
        const a = calculateDiscount({
          order: { ...o, items: [] },
          vouchers: vs as DiscountVoucher[],
        });
        const reversed = [...vs].reverse() as DiscountVoucher[];
        const b = calculateDiscount({ order: { ...o, items: [] }, vouchers: reversed });
        return a.finalOrder.amount === b.finalOrder.amount;
      }),
    );
  });
});
