import { implement } from "@orpc/server";
import { sql } from "drizzle-orm";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";

const os = implement(contract).$context<RequestContext>();

interface DailyCount {
  day: string;
  total: number;
}
interface TopCampaign {
  campaignId: string;
  campaignName: string;
  redemptions: number;
}
interface FailureBreakdown {
  reason: string;
  total: number;
}
interface WebhookHealth {
  status: "succeeded" | "failed" | "dead" | "pending";
  total: number;
}

const summary = os.insights.summary.use(requireSession).handler(async () => {
  const sinceDays = 30;
  const sinceTs = sql`NOW() - INTERVAL '30 days'`;

  const [redemptionsToday, redemptions7, redemptions30] = await Promise.all([
    db().execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM redemption
          WHERE result = 'SUCCESS' AND created_at >= NOW() - INTERVAL '1 day'`,
    ),
    db().execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM redemption
          WHERE result = 'SUCCESS' AND created_at >= NOW() - INTERVAL '7 days'`,
    ),
    db().execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM redemption
          WHERE result = 'SUCCESS' AND created_at >= ${sinceTs}`,
    ),
  ]);

  const dailyRows = await db().execute<{ day: string; total: number }>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           count(*)::int AS total
    FROM redemption
    WHERE result = 'SUCCESS' AND created_at >= ${sinceTs}
    GROUP BY day
    ORDER BY day ASC
  `);

  const topCampaignsRows = await db().execute<{
    campaign_id: string;
    campaign_name: string;
    redemptions: number;
  }>(sql`
    SELECT v.campaign_id AS campaign_id, c.name AS campaign_name, count(*)::int AS redemptions
    FROM redemption r
    JOIN voucher v ON v.id = r.voucher_id
    JOIN campaign c ON c.id = v.campaign_id
    WHERE r.result = 'SUCCESS' AND r.created_at >= ${sinceTs}
    GROUP BY v.campaign_id, c.name
    ORDER BY redemptions DESC
    LIMIT 5
  `);

  const failureRows = await db().execute<{ reason: string; total: number }>(sql`
    SELECT COALESCE(failure_reason, 'unknown') AS reason, count(*)::int AS total
    FROM redemption
    WHERE result = 'FAILURE' AND created_at >= ${sinceTs}
    GROUP BY reason
    ORDER BY total DESC
    LIMIT 8
  `);

  const webhookRows = await db().execute<{ status: string; total: number }>(sql`
    SELECT status, count(*)::int AS total
    FROM webhook_delivery
    WHERE created_at >= ${sinceTs}
    GROUP BY status
  `);

  const counters: { redemptionsToday: number; redemptions7d: number; redemptions30d: number } = {
    redemptionsToday: redemptionsToday.rows[0]?.total ?? 0,
    redemptions7d: redemptions7.rows[0]?.total ?? 0,
    redemptions30d: redemptions30.rows[0]?.total ?? 0,
  };

  const daily: DailyCount[] = dailyRows.rows.map((r) => ({ day: r.day, total: r.total }));
  const topCampaigns: TopCampaign[] = topCampaignsRows.rows.map((r) => ({
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    redemptions: r.redemptions,
  }));
  const failures: FailureBreakdown[] = failureRows.rows.map((r) => ({
    reason: r.reason,
    total: r.total,
  }));
  const webhooks: WebhookHealth[] = webhookRows.rows.map((r) => ({
    status: r.status as WebhookHealth["status"],
    total: r.total,
  }));

  return { sinceDays, counters, daily, topCampaigns, failures, webhooks };
});

export const insightsRouter = { summary };
