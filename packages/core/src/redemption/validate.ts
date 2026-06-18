import { and, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { withSpan } from "../observability/index.ts";
import { resolveCustomerRef, validateVoucher } from "./shared.ts";
import type {
  RedemptionCustomerRow,
  RedemptionCampaignRow,
  RedemptionValidationRuleRow,
  ValidateInput,
  ValidateResult,
  VoucherRow,
} from "./types.ts";

export function validate(db: Db, input: ValidateInput): Promise<ValidateResult> {
  return withSpan(
    "voucher.validate",
    () => validateImpl(db, input),
    {
      "voucher.code": input.voucherCode,
      ...(input.customerId ? { "customer.id": input.customerId } : {}),
      ...(input.customerExternalId ? { "customer.external_id": input.customerExternalId } : {}),
    },
  );
}

async function validateImpl(db: Db, input: ValidateInput): Promise<ValidateResult> {
  const row = (await db
    .select()
    .from(schema.voucher)
    .where(and(eq(schema.voucher.code, input.voucherCode), isNull(schema.voucher.deletedAt)))
    .limit(1)) as VoucherRow[];
  const voucher = row[0];
  if (!voucher) return validateVoucher(voucher, input.order, undefined, { db });
  const campaign = voucher?.campaignId
    ? ((await db.query.campaign.findFirst({
        where: and(eq(schema.campaign.id, voucher.campaignId), isNull(schema.campaign.deletedAt)),
      })) as RedemptionCampaignRow | undefined)
    : undefined;
  const validationRule = campaign?.validationRuleId
    ? ((await db.query.validationRule.findFirst({
        where: eq(schema.validationRule.id, campaign.validationRuleId),
      })) as RedemptionValidationRuleRow | undefined)
    : undefined;
  const resolvedCustomer = await resolveCustomerRef(
    db,
    {
      customerId: input.customerId,
      customerExternalId: input.customerExternalId,
    },
    { createIfMissing: true },
  );
  if (resolvedCustomer.mismatch) {
    return {
      valid: false,
      code: "customer_mismatch",
      message: "Voucher can only be redeemed by the assigned customer",
    };
  }
  const customerId = resolvedCustomer.customerId ?? voucher?.customerId ?? undefined;
  const customer =
    resolvedCustomer.customer ??
    (customerId
      ? ((await db.query.customer.findFirst({
          where: and(eq(schema.customer.id, customerId), isNull(schema.customer.deletedAt)),
        })) as RedemptionCustomerRow | undefined)
      : undefined);
  return validateVoucher(voucher, input.order, campaign, {
    db,
    validationRule,
    customer,
    customerId: resolvedCustomer.customerId,
  });
}
