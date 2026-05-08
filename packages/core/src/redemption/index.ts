// Redemption transaction (DB tx + event emit + idempotency).
// Phase 3 implementation lands here.
export interface RedeemInput {
  voucherCode: string;
  customerId?: string;
  orderId?: string;
  idempotencyKey?: string;
}

export function redeem(_input: RedeemInput): Promise<unknown> {
  throw new Error("not implemented (Phase 3)");
}
