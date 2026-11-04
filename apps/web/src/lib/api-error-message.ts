"use client";

import { useCallback } from "react";
import { useGT } from "gt-next/client";

type Gt = ReturnType<typeof useGT>;

/**
 * Pulls the error code and `message` out of the error shapes the dashboard
 * sees: thrown oRPC client errors (`ORPCError`), `{ ok: false, code, message }`
 * results from loyalty procedures, `{ ok: false, errorCode, message }` results
 * from referral procedures (where `code` is the referral code, not an error),
 * and better-auth `error` objects.
 */
export function readApiError(error: unknown): { code?: string; message?: string } {
  if (!error || typeof error !== "object") return {};
  const record = error as Record<string, unknown>;
  const code =
    typeof record["errorCode"] === "string"
      ? record["errorCode"]
      : typeof record["code"] === "string"
        ? record["code"]
        : undefined;
  const message =
    typeof record["message"] === "string" && record["message"].length > 0
      ? record["message"]
      : undefined;
  return { code, message };
}

/**
 * Translations for stable API error codes. Generic transport codes such as
 * NOT_FOUND or BAD_REQUEST are deliberately absent: their server message is
 * more specific, so it is matched in `messageTranslations` instead.
 */
function codeTranslations(gt: Gt): Record<string, string> {
  return {
    // Contract error codes (packages/contract/src/errors.ts)
    voucher_not_found: gt("Voucher not found"),
    voucher_expired: gt("This voucher has expired"),
    voucher_disabled: gt("This voucher is disabled"),
    redemption_limit_reached: gt("This voucher has reached its redemption limit"),
    per_user_redemption_limit_reached: gt(
      "This customer has reached the per-customer redemption limit",
    ),
    customer_required: gt("A customer is required"),
    customer_mismatch: gt("This voucher belongs to a different customer"),
    currency_mismatch: gt("The currency does not match the campaign currency"),
    idempotency_key_reused: gt("This idempotency key was already used for a different request"),
    rate_limited: gt("Too many requests. Try again in a moment."),
    unauthorized: gt("Sign in required"),
    forbidden: gt("You do not have permission to do this"),
    // Loyalty and referral failure codes (packages/core)
    program_not_found: gt("Program not found"),
    member_not_found: gt("Loyalty member not found"),
    reward_not_found: gt("Reward not found in this program"),
    reward_unavailable: gt("This reward is not available"),
    transaction_not_found: gt("Transaction not found"),
    referrer_not_found: gt("Referrer customer not found"),
    referral_not_found: gt("Referral code not found"),
    referee_already_converted: gt("This referee has already converted this referral code"),
    self_referral: gt("Referrer cannot also be the referee"),
    missing_loyalty_member: gt("The customer is not enrolled in the loyalty program"),
    // oRPC transport codes whose server message is generic
    UNAUTHORIZED: gt("Sign in required"),
    TOO_MANY_REQUESTS: gt("Too many requests. Try again in a moment."),
    // better-auth codes
    INVALID_EMAIL_OR_PASSWORD: gt("Invalid email or password"),
    INVALID_PASSWORD: gt("Invalid password"),
    PASSWORD_TOO_SHORT: gt("Password is too short"),
    PASSWORD_TOO_LONG: gt("Password is too long"),
  };
}

/** Exact server messages behind generic codes (NOT_FOUND, CONFLICT, ...). */
function messageTranslations(gt: Gt): Record<string, string> {
  return {
    "Admin role required": gt("Admin role required"),
    "Sign in required": gt("Sign in required"),
    "Campaign not found": gt("Campaign not found"),
    "Voucher not found": gt("Voucher not found"),
    "Order not found": gt("Order not found"),
    "Customer not found": gt("Customer not found"),
    "Webhook not found": gt("Webhook not found"),
    "Validation rule not found": gt("Validation rule not found"),
    "Tier not found": gt("Tier not found"),
    "Segment not found": gt("Segment not found"),
    "Reward type not found": gt("Reward type not found"),
    "Referral program not found": gt("Referral program not found"),
    "Loyalty program not found": gt("Loyalty program not found"),
    "Earning rule not found": gt("Earning rule not found"),
    "User not found": gt("User not found"),
    "Reward not found": gt("Reward not found"),
    "Referral not found": gt("Referral not found"),
    "Member not found": gt("Member not found"),
    "Event not found": gt("Event not found"),
    "Delivery not found": gt("Delivery not found"),
    "API key not found": gt("API key not found"),
    "Promotion tier not found": gt("Promotion tier not found"),
    "Voucher code already exists": gt("Voucher code already exists"),
    "Campaign already has an active referral program": gt(
      "Campaign already has an active referral program",
    ),
    "Cannot disable your own account": gt("You cannot disable your own account"),
    "Cannot demote your own account": gt("You cannot demote your own account"),
    "Promotion tiers require a PROMOTION campaign": gt(
      "Promotion tiers require a PROMOTION campaign",
    ),
    "Gift voucher campaigns can only issue gift cards": gt(
      "Gift voucher campaigns can only issue gift cards",
    ),
    "Gift cards require a positive starting balance": gt(
      "Gift cards require a positive starting balance",
    ),
    "Discount vouchers require a positive discount or custom reward": gt(
      "Discount vouchers require a positive discount or custom reward",
    ),
    "Discount campaigns can only issue discount vouchers": gt(
      "Discount campaigns can only issue discount vouchers",
    ),
    "Campaign type must be REFERRAL_PROGRAM": gt("Campaign type must be REFERRAL_PROGRAM"),
    "Campaign type must be LOYALTY_PROGRAM": gt("Campaign type must be LOYALTY_PROGRAM"),
    "Referral programs issue codes from the referral page": gt(
      "Referral programs issue codes from the referral page",
    ),
    "Promotion validation rule is unavailable": gt("Promotion validation rule is unavailable"),
    "Promotion validation rule did not match": gt("Promotion validation rule did not match"),
    "Insert failed": gt("Could not save the record"),
    "Update failed": gt("Could not save the changes"),
    "Base points must be positive": gt("Base points must be positive"),
    "Unable to load connections": gt("Unable to load connections"),
    "Unable to revoke connection": gt("Unable to revoke connection"),
  };
}

/**
 * Resolves an API error to a message in the active locale: a known error
 * `code` first, then a known exact server message, then the server message
 * as-is, then `fallback`. The API contract and server messages are unchanged.
 */
export function translateApiError(gt: Gt, error: unknown, fallback: string): string {
  const { code, message } = readApiError(error);
  if (code) {
    const byCode = codeTranslations(gt)[code];
    if (byCode) return byCode;
  }
  if (message) return messageTranslations(gt)[message] ?? message;
  return fallback;
}

/** Hook form of {@link translateApiError} bound to the active locale. */
export function useApiErrorMessage() {
  const gt = useGT();
  return useCallback(
    (error: unknown, fallback: string) => translateApiError(gt, error, fallback),
    [gt],
  );
}
