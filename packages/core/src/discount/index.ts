// Discount calculation pipeline — pure function, property-tested.
// Phase 3 implementation lands here.
export interface DiscountInput {
  order: { amount: number; currency: string; items: unknown[] };
  vouchers: unknown[];
}

export interface DiscountResult {
  appliedDiscounts: unknown[];
  finalOrder: { amount: number; currency: string };
  breakdown: unknown[];
}

export function calculateDiscount(_input: DiscountInput): DiscountResult {
  throw new Error("not implemented (Phase 3)");
}
