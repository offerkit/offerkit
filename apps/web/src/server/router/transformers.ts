import type { schema } from "@open-voucherify/db";

export type CustomerRow = typeof schema.customer.$inferSelect;
export type SegmentRow = typeof schema.segment.$inferSelect;
export type CampaignRow = typeof schema.campaign.$inferSelect;
export type VoucherRow = typeof schema.voucher.$inferSelect;
export type ValidationRuleRow = typeof schema.validationRule.$inferSelect;
export type RewardTypeRow = typeof schema.rewardType.$inferSelect;
export type RewardTypeRevisionRow = typeof schema.rewardTypeRevision.$inferSelect;
export type OrderRow = typeof schema.order.$inferSelect;

export function toCustomer(row: CustomerRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    address: row.address,
    metadata: row.metadata,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSegment(row: SegmentRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rule: row.rule,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    currency: row.currency,
    timezone: row.timezone,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    codeConfig: row.codeConfig,
    validationRuleId: row.validationRuleId,
    autoApply: row.autoApply,
    voucherCount: row.voucherCount,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVoucher(row: VoucherRow) {
  return {
    id: row.id,
    code: row.code,
    campaignId: row.campaignId,
    type: row.type,
    discount: row.discount,
    customRewards: row.customRewards,
    giftBalance: row.giftBalance,
    redemptionLimit: row.redemptionLimit,
    redemptionCount: row.redemptionCount,
    priority: row.priority,
    exclusive: row.exclusive,
    active: row.active,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    customerId: row.customerId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toValidationRule(row: ValidationRuleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rule: row.rule,
    appliesTo: row.appliesTo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toOrder(row: OrderRow) {
  return {
    id: row.id,
    externalId: row.externalId,
    customerId: row.customerId,
    items: row.items,
    amount: row.amount,
    discountAmount: row.discountAmount,
    currency: row.currency,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRewardType(row: RewardTypeRow, revision: RewardTypeRevisionRow | undefined) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    payloadSchema: revision?.payloadSchema ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
