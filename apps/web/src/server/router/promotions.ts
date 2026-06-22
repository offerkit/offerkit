import { ORPCError, implement } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { calculateDiscount } from "@offerkit/core/discount";
import type { RuleContext } from "@offerkit/core/rules";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import { decodeCursor, paginatedSoftDeleteList, softDeleteById } from "./helpers";
import { evaluatePromotionRule } from "./promotion-qualification";

const os = implement(contract).$context<RequestContext>();

type PromotionTierRow = typeof schema.promotionTier.$inferSelect;
type CampaignRow = typeof schema.campaign.$inferSelect;
type ValidationRuleRow = typeof schema.validationRule.$inferSelect;

function toPromotionTier(row: PromotionTierRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    description: row.description,
    effect: row.effect,
    customRewards: row.customRewards,
    validationRuleId: row.validationRuleId,
    active: row.active,
    priority: row.priority,
    exclusive: row.exclusive,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requirePromotionCampaign(campaignId: string): Promise<CampaignRow> {
  const campaign = await db().query.campaign.findFirst({
    where: and(eq(schema.campaign.id, campaignId), isNull(schema.campaign.deletedAt)),
  });
  if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
  if (campaign.type !== "PROMOTION") {
    throw new ORPCError("BAD_REQUEST", { message: "Promotion tiers require a PROMOTION campaign" });
  }
  return campaign;
}

const tiersList = os.promotions.tiers.list
  .use(requireSession)
  .handler(({ input }) => {
    const filters = [];
    if (input.campaignId) filters.push(eq(schema.promotionTier.campaignId, input.campaignId));
    if (input.active !== undefined) filters.push(eq(schema.promotionTier.active, input.active));
    return paginatedSoftDeleteList<PromotionTierRow, ReturnType<typeof toPromotionTier>>({
      table: schema.promotionTier,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters,
      toOutput: toPromotionTier,
    });
  });

const tiersCreate = os.promotions.tiers.create
  .use(requireSession)
  .handler(async ({ input }) => {
    await requirePromotionCampaign(input.campaignId);
    const [row] = await db()
      .insert(schema.promotionTier)
      .values({
        campaignId: input.campaignId,
        name: input.name,
        description: input.description ?? null,
        effect: input.effect,
        customRewards: input.customRewards ?? [],
        validationRuleId: input.validationRuleId ?? null,
        active: input.active ?? true,
        priority: input.priority ?? 0,
        exclusive: input.exclusive ?? false,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toPromotionTier(row);
  });

const tiersUpdate = os.promotions.tiers.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.promotionTier.$inferInsert> = { updatedAt: new Date() };
    const { patch: inputPatch } = input.body;
    if (inputPatch.name !== undefined) patch.name = inputPatch.name;
    if (inputPatch.description !== undefined) patch.description = inputPatch.description ?? null;
    if (inputPatch.effect !== undefined) patch.effect = inputPatch.effect;
    if (inputPatch.customRewards !== undefined) patch.customRewards = inputPatch.customRewards;
    if (inputPatch.validationRuleId !== undefined)
      patch.validationRuleId = inputPatch.validationRuleId ?? null;
    if (inputPatch.active !== undefined) patch.active = inputPatch.active;
    if (inputPatch.priority !== undefined) patch.priority = inputPatch.priority;
    if (inputPatch.exclusive !== undefined) patch.exclusive = inputPatch.exclusive;
    if (inputPatch.startDate !== undefined)
      patch.startDate = inputPatch.startDate ? new Date(inputPatch.startDate) : null;
    if (inputPatch.endDate !== undefined)
      patch.endDate = inputPatch.endDate ? new Date(inputPatch.endDate) : null;
    if (inputPatch.metadata !== undefined) patch.metadata = inputPatch.metadata;

    const [row] = await db()
      .update(schema.promotionTier)
      .set(patch)
      .where(and(eq(schema.promotionTier.id, input.params.id), isNull(schema.promotionTier.deletedAt)))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Promotion tier not found" });
    return toPromotionTier(row);
  });

const tiersDelete = os.promotions.tiers.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    await softDeleteById(schema.promotionTier, input.params.id, "Promotion tier not found");
    return { ok: true as const };
  });

function activeWindow(startDate: Date | null, endDate: Date | null, now: Date) {
  if (startDate && startDate > now) return false;
  if (endDate && endDate < now) return false;
  return true;
}

function skip(tier: PromotionTierRow, campaign: CampaignRow, reason: string, message: string) {
  return {
    source: "promotion" as const,
    campaignId: campaign.id,
    promotionTierId: tier.id,
    name: tier.name,
    discount: tier.effect,
    customRewards: tier.customRewards,
    priority: tier.priority,
    exclusive: tier.exclusive,
    metadata: tier.metadata,
    reason: reason as
      | "campaign_inactive"
      | "campaign_not_active"
      | "promotion_inactive"
      | "promotion_not_active"
      | "currency_mismatch"
      | "rule_failed"
      | "rule_error"
      | "no_discount_effect"
      | "exclusivity_lost"
      | "zero_after_running_total",
    message,
  };
}

const qualify = os.promotions.qualify
  .use(requireSession)
  .handler(async ({ input }) => {
    const now = new Date();
    const filters = [
      isNull(schema.promotionTier.deletedAt),
      isNull(schema.campaign.deletedAt),
      eq(schema.campaign.type, "PROMOTION"),
      eq(schema.campaign.autoApply, true),
    ];
    if (input.filters?.campaignIds?.length) {
      filters.push(inArray(schema.campaign.id, input.filters.campaignIds));
    }

    const rows = await db()
      .select({ tier: schema.promotionTier, campaign: schema.campaign })
      .from(schema.promotionTier)
      .innerJoin(schema.campaign, eq(schema.campaign.id, schema.promotionTier.campaignId))
      .where(and(...filters));

    const ruleIds = [
      ...new Set(
        rows.flatMap(({ tier, campaign }) => [tier.validationRuleId, campaign.validationRuleId]).filter(Boolean),
      ),
    ] as string[];
    const rules = ruleIds.length
      ? await db().query.validationRule.findMany({ where: inArray(schema.validationRule.id, ruleIds) })
      : [];
    const ruleById = new Map<string, ValidationRuleRow>(rules.map((rule) => [rule.id, rule]));

    const customer = input.customerId
      ? await db().query.customer.findFirst({
          where: and(eq(schema.customer.id, input.customerId), isNull(schema.customer.deletedAt)),
        })
      : undefined;

    const eligible = [];
    const skipped = [];
    const context: RuleContext = {
      customer: customer
        ? {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            phone: customer.phone,
            address: customer.address as Record<string, unknown> | null,
            metadata: customer.metadata,
            summary: customer.summary,
          }
        : undefined,
      order: { ...input.order, items: input.order.items ?? [] },
      now: now.toISOString(),
      metadata: input.metadata ?? {},
    };

    for (const { tier, campaign } of rows) {
      if (campaign.status !== "active") {
        skipped.push(skip(tier, campaign, "campaign_inactive", "Campaign is not active"));
        continue;
      }
      if (!activeWindow(campaign.startDate, campaign.endDate, now)) {
        skipped.push(skip(tier, campaign, "campaign_not_active", "Campaign is outside its active window"));
        continue;
      }
      if (campaign.currency !== input.order.currency) {
        skipped.push(skip(tier, campaign, "currency_mismatch", "Campaign currency does not match order currency"));
        continue;
      }
      if (!tier.active) {
        skipped.push(skip(tier, campaign, "promotion_inactive", "Promotion tier is inactive"));
        continue;
      }
      if (!activeWindow(tier.startDate, tier.endDate, now)) {
        skipped.push(skip(tier, campaign, "promotion_not_active", "Promotion tier is outside its active window"));
        continue;
      }

      const ruleIdsForTier = [campaign.validationRuleId, tier.validationRuleId].filter(Boolean) as string[];
      let failed = false;
      for (const ruleId of ruleIdsForTier) {
        const failure = evaluatePromotionRule(ruleById.get(ruleId), context);
        if (failure) {
          skipped.push(skip(tier, campaign, failure.reason, failure.message));
          failed = true;
          break;
        }
      }
      if (failed) continue;

      eligible.push({
        source: "promotion" as const,
        campaignId: campaign.id,
        promotionTierId: tier.id,
        name: tier.name,
        discount: tier.effect,
        customRewards: tier.customRewards,
        priority: tier.priority,
        exclusive: tier.exclusive,
        metadata: tier.metadata,
      });
    }

    const discount = calculateDiscount({
      order: input.order,
      vouchers: eligible.map((candidate) => ({
        id: candidate.promotionTierId,
        code: `PROMO:${candidate.promotionTierId}`,
        type: candidate.discount.type,
        amount: candidate.discount.amount,
        percent: candidate.discount.percent,
        maxDiscountAmount: candidate.discount.maxDiscountAmount,
        priority: candidate.priority,
        exclusive: candidate.exclusive,
      })),
    });

    if (input.filters?.includeSkipped !== false) {
      for (const entry of discount.breakdown) {
        if (!entry.reason) continue;
        const candidate = eligible.find((item) => item.promotionTierId === entry.voucherId);
        if (!candidate) continue;
        skipped.push({
          ...candidate,
          reason: entry.reason,
          message:
            entry.reason === "exclusivity_lost"
              ? "Promotion was skipped because an exclusive promotion won"
              : "Promotion produced no discount after previous promotions",
        });
      }
    }

    const appliedIds = new Set(discount.appliedDiscounts.map((entry) => entry.voucherId));
    const appliedEligible = eligible.filter(
      (candidate) => appliedIds.has(candidate.promotionTierId) || candidate.customRewards.length > 0,
    );

    return {
      eligible: appliedEligible,
      skipped: input.filters?.includeSkipped === false ? [] : skipped,
      preview: {
        amount: input.order.amount - discount.finalOrder.amount,
        finalOrder: discount.finalOrder,
        breakdown: discount.breakdown,
      },
    };
  });

export const promotionsRouter = {
  tiers: {
    list: tiersList,
    create: tiersCreate,
    update: tiersUpdate,
    delete: tiersDelete,
  },
  qualify,
};
