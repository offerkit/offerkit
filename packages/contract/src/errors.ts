export const errorCodes = [
  "voucher_not_found",
  "voucher_expired",
  "voucher_disabled",
  "redemption_limit_reached",
  "per_user_redemption_limit_reached",
  "customer_required",
  "customer_mismatch",
  "validation_failed",
  "insufficient_loyalty_points",
  "currency_mismatch",
  "idempotency_key_reused",
  "rate_limited",
  "unauthorized",
  "forbidden",
  "validation_error",
  "not_found",
  "conflict",
  "internal",
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export const errorStatusByCode: Record<ErrorCode, number> = {
  voucher_not_found: 404,
  voucher_expired: 422,
  voucher_disabled: 422,
  redemption_limit_reached: 422,
  per_user_redemption_limit_reached: 422,
  customer_required: 422,
  customer_mismatch: 422,
  validation_failed: 422,
  insufficient_loyalty_points: 422,
  currency_mismatch: 422,
  idempotency_key_reused: 409,
  rate_limited: 429,
  unauthorized: 401,
  forbidden: 403,
  validation_error: 400,
  not_found: 404,
  conflict: 409,
  internal: 500,
};
