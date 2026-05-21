import type { DiscountOrder, DiscountResult } from "../discount/index.ts";

export type RedemptionFailureCode =
  | "voucher_not_found"
  | "voucher_disabled"
  | "voucher_expired"
  | "redemption_limit_reached"
  | "currency_mismatch"
  | "gift_balance_zero"
  | "order_required";

export type RedemptionExplanationCode =
  | RedemptionFailureCode
  | "exclusivity_lost"
  | "zero_after_running_total"
  | "gift_card_stacking_unsupported";

export interface RedemptionExplanation {
  code: RedemptionExplanationCode;
  message: string;
  voucherId?: string;
  voucherCode?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RedeemInput {
  voucherCode: string;
  customerId?: string;
  /** uuid of an `order` row created in this system. */
  orderId?: string;
  /** Integrator's free-form order reference (Shopify id, internal sale id, etc). */
  externalOrderId?: string;
  order?: DiscountOrder;
  idempotencyKey?: string;
}

export interface RedeemSuccess {
  ok: true;
  redemptionId: string;
  amount: number;
  breakdown: DiscountResult["breakdown"];
  finalOrder: DiscountResult["finalOrder"];
  idempotent?: boolean;
}

export interface RedeemFailure {
  ok: false;
  code: RedemptionFailureCode;
  message: string;
  explanations?: RedemptionExplanation[];
}

export type RedeemResult = RedeemSuccess | RedeemFailure;

export interface ValidateInput {
  voucherCode: string;
  customerId?: string;
  order?: DiscountOrder;
}

export interface ValidateResult {
  valid: boolean;
  code?: RedemptionFailureCode;
  message?: string;
  explanations?: RedemptionExplanation[];
  preview?: { amount: number; finalOrder: DiscountResult["finalOrder"]; breakdown: DiscountResult["breakdown"] };
}

export interface StackRedeemInput {
  voucherCodes: string[];
  customerId?: string;
  orderId?: string;
  externalOrderId?: string;
  order: DiscountOrder;
  idempotencyKey?: string;
}

export interface StackEntry {
  voucherCode: string;
  voucherId: string;
  redemptionId: string;
  amount: number;
}

export interface StackRedeemSuccess {
  ok: true;
  batchId: string;
  amount: number;
  finalOrder: DiscountResult["finalOrder"];
  breakdown: DiscountResult["breakdown"];
  entries: StackEntry[];
  explanations?: RedemptionExplanation[];
  idempotent?: boolean;
}

export type StackRedeemResult = StackRedeemSuccess | RedeemFailure;

/** Internal projection of the voucher row used by every redemption code path. */
export interface VoucherRow extends Record<string, unknown> {
  id: string;
  code: string;
  campaignId: string | null;
  type: string;
  discount: { type: "AMOUNT" | "PERCENTAGE"; amount?: number; percent?: number; maxDiscountAmount?: number } | null;
  giftBalance: number | null;
  redemptionLimit: number | null;
  redemptionCount: number;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  priority: number;
  exclusive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}
