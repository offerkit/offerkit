import { and, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { withSpan } from "../observability/index.ts";
import { validateVoucher } from "./shared.ts";
import type {
  RedemptionCampaignRow,
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
  const campaign = voucher?.campaignId
    ? ((await db.query.campaign.findFirst({
        where: and(eq(schema.campaign.id, voucher.campaignId), isNull(schema.campaign.deletedAt)),
      })) as RedemptionCampaignRow | undefined)
    : undefined;
  return validateVoucher(voucher, input.order, campaign);
}
