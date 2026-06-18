import type { DiscountResult } from "../discount/index.ts";
import type { RedemptionFailureCode, RedemptionExplanation, VoucherRow } from "./types.ts";
import { messageFor } from "./shared.ts";

export function failureExplanation(
  code: RedemptionFailureCode,
  voucher?: Pick<
    VoucherRow,
    | "id"
    | "code"
    | "campaignId"
    | "active"
    | "startDate"
    | "endDate"
    | "redemptionCount"
    | "redemptionLimit"
    | "perUserRedemptionLimit"
    | "giftBalance"
    | "type"
  >,
  details: Record<string, string | number | boolean | null> = {},
): RedemptionExplanation {
  const safeDetails: Record<string, string | number | boolean | null> = { ...details };

  if (voucher) {
    if (code === "voucher_disabled") safeDetails.active = voucher.active;
    if (code === "voucher_expired") {
      safeDetails.startsAt = voucher.startDate?.toISOString() ?? null;
      safeDetails.endsAt = voucher.endDate?.toISOString() ?? null;
    }
    if (code === "redemption_limit_reached") {
      safeDetails.redemptionCount = voucher.redemptionCount;
      safeDetails.redemptionLimit = voucher.redemptionLimit;
    }
    if (
      code === "per_user_redemption_limit_reached" &&
      !("perUserRedemptionLimit" in safeDetails)
    ) {
      safeDetails.perUserRedemptionLimit = voucher.perUserRedemptionLimit;
    }
    if (code === "gift_balance_zero") safeDetails.giftBalance = voucher.giftBalance ?? 0;
    if (code === "campaign_inactive") safeDetails.campaignId = voucher.campaignId ?? null;
    if (code === "no_discount_effect") safeDetails.type = voucher.type;
  }

  return {
    code,
    message: messageFor(code),
    voucherId: voucher?.id,
    voucherCode: voucher?.code,
    details: safeDetails,
  };
}

export function stackBreakdownExplanations(
  breakdown: DiscountResult["breakdown"],
): RedemptionExplanation[] {
  return breakdown
    .filter((entry) => "reason" in entry && entry.reason !== undefined)
    .map((entry) => ({
      code: entry.reason,
      message:
        entry.reason === "exclusivity_lost"
          ? "Voucher skipped because an exclusive voucher was applied"
          : "Voucher skipped because the running order total was already zero",
      voucherId: entry.voucherId,
      voucherCode: entry.code,
      details: { amount: entry.amount },
    }));
}
