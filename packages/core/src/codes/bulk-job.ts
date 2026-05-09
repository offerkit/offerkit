import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { logger } from "../observability/index.ts";
import { generateUniqueCodes } from "./generate.ts";

const log = logger.child({ component: "bulk-codes" });

/**
 * Largest count we generate inside a single oRPC call. Anything bigger
 * is queued as `bulk_codes.generate` and produced by the worker in
 * batches of `BULK_BATCH_SIZE` so a single tx never holds tens of
 * thousands of inserts.
 */
export const BULK_INLINE_THRESHOLD = 10_000;
const BULK_BATCH_SIZE = 1_000;

export interface BulkCodesPayload {
  campaignId: string;
  count: number;
}

/** Worker handler for the `bulk_codes.generate` job. */
export async function bulkGenerateCodes(
  db: Db,
  payload: BulkCodesPayload,
): Promise<{ generated: number }> {
  const campaign = await db.query.campaign.findFirst({
    where: and(eq(schema.campaign.id, payload.campaignId), isNull(schema.campaign.deletedAt)),
  });
  if (!campaign) {
    log.warn({ campaignId: payload.campaignId }, "campaign missing for bulk codes");
    return { generated: 0 };
  }

  const type: "DISCOUNT" | "GIFT_CARD" =
    campaign.type === "GIFT_VOUCHERS" ? "GIFT_CARD" : "DISCOUNT";

  const remaining = payload.count;
  const codeExists = async (code: string): Promise<boolean> => {
    const hit = await db
      .select({ id: schema.voucher.id })
      .from(schema.voucher)
      .where(eq(schema.voucher.code, code))
      .limit(1);
    return hit.length > 0;
  };

  let generated = 0;
  for (let offset = 0; offset < remaining; offset += BULK_BATCH_SIZE) {
    const batchSize = Math.min(BULK_BATCH_SIZE, remaining - offset);
    const codes = await generateUniqueCodes(
      batchSize,
      (campaign.codeConfig ?? {}) as Record<string, unknown>,
      codeExists,
    );
    await db
      .insert(schema.voucher)
      .values(codes.map((code) => ({ code, campaignId: campaign.id, type })));
    await db
      .update(schema.campaign)
      .set({
        voucherCount: sql`${schema.campaign.voucherCount} + ${codes.length}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaign.id, campaign.id));
    generated += codes.length;
    log.info(
      { campaignId: campaign.id, generated, target: payload.count },
      "bulk code batch inserted",
    );
  }

  return { generated };
}
