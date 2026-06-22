import type { Db } from "@offerkit/db";
import { enqueueJob, type JobRegistry } from "@offerkit/core/jobs";
import { deliverWebhook } from "@offerkit/core/events";
import { expirePoints } from "@offerkit/core/loyalty";
import { bulkGenerateCodes, type BulkCodesPayload } from "@offerkit/core/codes";
import { logger } from "@offerkit/core/observability";

const log = logger.child({ component: "worker" });

export const LOYALTY_EXPIRE_INTERVAL_MS = 24 * 60 * 60_000;

export function registerWorkerHandlers(registry: JobRegistry, db: Db): void {
  registry.register("webhook.deliver", async ({ jobId, payload }) => {
    const deliveryId = (payload as { deliveryId?: string }).deliveryId;
    if (!deliveryId) {
      log.warn({ jobId }, "webhook.deliver job missing deliveryId");
      return;
    }
    await deliverWebhook(db, { deliveryId });
  });

  registry.register("bulk_codes.generate", async ({ jobId, payload }) => {
    const typed = payload as Partial<BulkCodesPayload>;
    if (!typed.campaignId || typeof typed.count !== "number") {
      log.warn({ jobId }, "bulk_codes.generate job missing campaignId/count");
      return;
    }
    const result = await bulkGenerateCodes(db, {
      campaignId: typed.campaignId,
      count: typed.count,
      discount: typed.discount,
      giftBalance: typed.giftBalance,
    });
    log.info({ jobId, generated: result.generated }, "bulk codes generated");
  });

  registry.register("loyalty.points.expire", async ({ jobId }) => {
    const result = await expirePoints(db);
    log.info({ jobId, expired: result.expired }, "loyalty points expired");
    await enqueueJob(
      db,
      "loyalty.points.expire",
      {},
      { runAt: new Date(Date.now() + LOYALTY_EXPIRE_INTERVAL_MS) },
    );
  });
}
