// Discount calculation pipeline.
//
// Pure function: (order, vouchers[]) -> { appliedDiscounts, finalOrder, breakdown }.
// All money is in integer cents. Order is mutated only via the returned shape.
// The pipeline is deterministic given (order, vouchers) and has these invariants:
//   1. finalOrder.amount >= 0
//   2. sum(applied.amount) === order.amount - finalOrder.amount
//   3. ordering by (priority desc, createdAt asc, id) yields a stable result
//   4. an exclusive voucher in the input set short-circuits all others

export interface DiscountVoucher {
  id: string;
  code: string;
  type: "AMOUNT" | "PERCENTAGE";
  amount?: number;
  percent?: number;
  maxDiscountAmount?: number;
  priority?: number;
  exclusive?: boolean;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  collectionId?: string;
  quantity: number;
  unitPrice: number;
}

export interface DiscountOrder {
  amount: number;
  currency: string;
  items?: OrderItem[];
}

export interface AppliedDiscount {
  voucherId: string;
  code: string;
  amount: number;
  type: "AMOUNT" | "PERCENTAGE";
  reason?: never;
}

export interface SkippedDiscount {
  voucherId: string;
  code: string;
  amount: 0;
  reason: "exclusivity_lost" | "zero_after_running_total";
}

export type BreakdownEntry = AppliedDiscount | SkippedDiscount;

export interface DiscountInput {
  order: DiscountOrder;
  vouchers: DiscountVoucher[];
  /** Per-currency rounding mode (HALF_UP only in v1.0). */
  roundingMode?: "HALF_UP";
}

export interface DiscountResult {
  appliedDiscounts: AppliedDiscount[];
  breakdown: BreakdownEntry[];
  finalOrder: { amount: number; currency: string };
}

function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

function sortVouchers(vouchers: DiscountVoucher[]): DiscountVoucher[] {
  return [...vouchers].sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const ca = a.createdAt ?? "";
    const cb = b.createdAt ?? "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function applyOne(voucher: DiscountVoucher, runningTotal: number): number {
  if (voucher.type === "AMOUNT") {
    const off = Math.min(voucher.amount ?? 0, runningTotal);
    return Math.max(off, 0);
  }
  // PERCENTAGE — basis points (10000 = 100%).
  const bps = voucher.percent ?? 0;
  const raw = roundHalfUp((runningTotal * bps) / 10000);
  const capped =
    voucher.maxDiscountAmount != null ? Math.min(raw, voucher.maxDiscountAmount) : raw;
  return Math.min(Math.max(capped, 0), runningTotal);
}

export function calculateDiscount(input: DiscountInput): DiscountResult {
  const { order } = input;
  if (order.amount < 0) throw new Error("order.amount must be >= 0");

  // Exclusivity short-circuit: if any voucher is marked exclusive, only the
  // highest-priority exclusive applies; others are skipped.
  const exclusives = input.vouchers.filter((v) => v.exclusive === true);
  const candidates = exclusives.length > 0 ? sortVouchers(exclusives).slice(0, 1) : sortVouchers(input.vouchers);

  let runningTotal = order.amount;
  const applied: AppliedDiscount[] = [];
  const breakdown: BreakdownEntry[] = [];

  for (const voucher of candidates) {
    if (runningTotal <= 0) {
      breakdown.push({
        voucherId: voucher.id,
        code: voucher.code,
        amount: 0,
        reason: "zero_after_running_total",
      });
      continue;
    }
    const off = applyOne(voucher, runningTotal);
    if (off === 0) {
      breakdown.push({
        voucherId: voucher.id,
        code: voucher.code,
        amount: 0,
        reason: "zero_after_running_total",
      });
      continue;
    }
    runningTotal -= off;
    const entry: AppliedDiscount = {
      voucherId: voucher.id,
      code: voucher.code,
      amount: off,
      type: voucher.type,
    };
    applied.push(entry);
    breakdown.push(entry);
  }

  // Mark non-applied non-exclusive losers (when an exclusive won).
  if (exclusives.length > 0) {
    const winnerId = candidates[0]?.id;
    for (const v of input.vouchers) {
      if (v.id === winnerId) continue;
      breakdown.push({
        voucherId: v.id,
        code: v.code,
        amount: 0,
        reason: "exclusivity_lost",
      });
    }
  }

  return {
    appliedDiscounts: applied,
    breakdown,
    finalOrder: { amount: Math.max(runningTotal, 0), currency: order.currency },
  };
}
