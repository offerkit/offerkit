import { and, eq, inArray, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { withSpan } from "../observability/index.ts";
import { resolveCustomerRef, validateVoucher } from "./shared.ts";
import type {
  QualifyInput,
  RedemptionCustomerRow,
  RedemptionCampaignRow,
  RedemptionValidationRuleRow,
  VoucherQualificationResult,
  VoucherQualificationSkipped,
  VoucherRow,
} from "./types.ts";

export function qualify(db: Db, input: QualifyInput): Promise<VoucherQualificationResult> {
  return withSpan(
    "voucher.qualify",
    () => qualifyImpl(db, input),
    {
      ...(input.customerId ? { "customer.id": input.customerId } : {}),
      ...(input.customerExternalId ? { "customer.external_id": input.customerExternalId } : {}),
      "voucher.include_skipped": input.filters?.includeSkipped ?? false,
    },
  );
}

async function qualifyImpl(db: Db, input: QualifyInput): Promise<VoucherQualificationResult> {
  const resolvedCustomer = await resolveCustomerRef(
    db,
    {
      customerId: input.customerId,
      customerExternalId: input.customerExternalId,
    },
    { createIfMissing: true },
  );
  if (resolvedCustomer.mismatch || !resolvedCustomer.customerId) {
    return { eligible: [], skipped: [] };
  }

  const campaignIds = input.filters?.campaignIds ?? [];
  if (campaignIds.length === 0 && input.filters?.campaignIds) {
    return { eligible: [], skipped: [] };
  }

  const filters = [
    eq(schema.voucher.customerId, resolvedCustomer.customerId),
    isNull(schema.voucher.deletedAt),
  ];
  if (campaignIds.length > 0) {
    filters.push(inArray(schema.voucher.campaignId, campaignIds));
  }

  const vouchers = (await db
    .select()
    .from(schema.voucher)
    .where(and(...filters))) as VoucherRow[];

  const eligible: VoucherQualificationResult["eligible"] = [];
  const skipped: VoucherQualificationSkipped[] = [];
  const customer =
    resolvedCustomer.customer ??
    ((await db.query.customer.findFirst({
      where: and(eq(schema.customer.id, resolvedCustomer.customerId), isNull(schema.customer.deletedAt)),
    })) as RedemptionCustomerRow | undefined);

  for (const voucher of vouchers) {
    const campaign = voucher.campaignId
      ? ((await db.query.campaign.findFirst({
          where: and(eq(schema.campaign.id, voucher.campaignId), isNull(schema.campaign.deletedAt)),
        })) as RedemptionCampaignRow | undefined)
      : undefined;
    const validationRule = campaign?.validationRuleId
      ? ((await db.query.validationRule.findFirst({
          where: eq(schema.validationRule.id, campaign.validationRuleId),
        })) as RedemptionValidationRuleRow | undefined)
      : undefined;
    const result = await validateVoucher(voucher, input.order, campaign, {
      db,
      validationRule,
      customer,
      customerId: resolvedCustomer.customerId,
    });
    if (result.valid) {
      eligible.push({
        code: voucher.code,
        campaignId: voucher.campaignId,
        discount: voucher.discount,
        endDate: voucher.endDate?.toISOString() ?? null,
        preview: result.preview,
      });
      continue;
    }

    if (input.filters?.includeSkipped) {
      skipped.push({
        code: voucher.code,
        campaignId: voucher.campaignId,
        reason: result.code ?? "voucher_invalid",
        message: result.message ?? "Voucher is not eligible for this order",
      });
    }
  }

  return { eligible, skipped };
}
