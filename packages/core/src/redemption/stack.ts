import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { schema, type Db } from "@offerkit/db";
import { calculateDiscount, type DiscountResult } from "../discount/index.ts";
import { emitEvent } from "../events/index.ts";
import { failureExplanation, stackBreakdownExplanations } from "./explanations.ts";
import { logger, withSpan } from "../observability/index.ts";
import {
  checkActivation,
  checkCampaignActivation,
  checkCampaignValidationRule,
  checkCustomerBinding,
  lockCustomerForPerUserLimits,
  messageFor,
  resolveCustomerRef,
} from "./shared.ts";
import type {
  RedemptionCustomerRow,
  RedemptionCampaignRow,
  RedemptionValidationRuleRow,
  StackEntry,
  StackRedeemInput,
  StackRedeemResult,
  VoucherRow,
} from "./types.ts";

const log = logger.child({ component: "redemption" });

/**
 * Redeem multiple voucher codes against one order in a single
 * transaction. Either every redemption commits (with one batch_id) or
 * none do. Vouchers are locked in code-sorted order to avoid deadlocks
 * across concurrent stack calls that share codes.
 */
export function stackRedeem(
  db: Db,
  input: StackRedeemInput,
): Promise<StackRedeemResult> {
  return withSpan(
    "voucher.stack_redeem",
    () => stackRedeemImpl(db, input),
    {
      "voucher.code_count": input.voucherCodes.length,
      ...(input.customerId ? { "customer.id": input.customerId } : {}),
      ...(input.customerExternalId ? { "customer.external_id": input.customerExternalId } : {}),
    },
  );
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function stackRedeemImpl(
  db: Db,
  input: StackRedeemInput,
): Promise<StackRedeemResult> {
  if (input.voucherCodes.length === 0) {
    return {
      ok: false,
      code: "voucher_not_found",
      message: "No voucher codes supplied",
      explanations: [
        {
          code: "voucher_not_found",
          message: "No voucher codes supplied",
          details: { suppliedCodes: 0 },
        },
      ],
    };
  }
  // Dedupe + sort to make the lock acquisition order deterministic.
  const codes = [...new Set(input.voucherCodes)].sort();

  return db.transaction(async (tx) => {
    const resolvedCustomer = await resolveCustomerRef(
      tx,
      {
        customerId: input.customerId,
        customerExternalId: input.customerExternalId,
      },
      { createIfMissing: true },
    );
    if (resolvedCustomer.mismatch) {
      return {
        ok: false,
        code: "customer_mismatch",
        message: messageFor("customer_mismatch"),
        explanations: [failureExplanation("customer_mismatch")],
      };
    }
    const resolvedCustomerId = resolvedCustomer.customerId;

    if (input.idempotencyKey) {
      const replay = await replayBatch(tx, input);
      if (replay) return replay;
    }

    const lockedRows = (await tx
      .select()
      .from(schema.voucher)
      .where(and(inArray(schema.voucher.code, codes), isNull(schema.voucher.deletedAt)))
      .orderBy(schema.voucher.code)
      .for("update")) as VoucherRow[];

    if (lockedRows.length !== codes.length) {
      const found = new Set(lockedRows.map((v) => v.code));
      const missing = codes.find((c) => !found.has(c));
      return {
        ok: false,
        code: "voucher_not_found",
        message: `Voucher not found: ${String(missing)}`,
        explanations: [
          {
            code: "voucher_not_found",
            message: "Voucher not found",
            voucherCode: missing,
          },
        ],
      };
    }

    const now = new Date();
    const campaignIds = [
      ...new Set(lockedRows.flatMap((voucher) => voucher.campaignId ?? [])),
    ];
    const campaigns = campaignIds.length
      ? ((await tx.query.campaign.findMany({
          where: and(
            inArray(schema.campaign.id, campaignIds),
            isNull(schema.campaign.deletedAt),
          ),
        })) as RedemptionCampaignRow[])
      : [];
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const validationRuleIds = [
      ...new Set(campaigns.flatMap((campaign) => campaign.validationRuleId ?? [])),
    ];
    const validationRules = validationRuleIds.length
      ? ((await tx.query.validationRule.findMany({
          where: inArray(schema.validationRule.id, validationRuleIds),
        })) as RedemptionValidationRuleRow[])
      : [];
    const validationRuleById = new Map(validationRules.map((rule) => [rule.id, rule]));
    const hasPerUserLimit = lockedRows.some((voucher) => {
      const campaign = voucher.campaignId ? campaignById.get(voucher.campaignId) : undefined;
      return voucher.perUserRedemptionLimit != null || campaign?.perUserRedemptionLimit != null;
    });
    const lockedCustomer =
      resolvedCustomerId && hasPerUserLimit
        ? await lockCustomerForPerUserLimits(tx, resolvedCustomerId)
        : undefined;
    const customer =
      lockedCustomer ??
      resolvedCustomer.customer ??
      (resolvedCustomerId
        ? ((await tx.query.customer.findFirst({
            where: and(eq(schema.customer.id, resolvedCustomerId), isNull(schema.customer.deletedAt)),
          })) as RedemptionCustomerRow | undefined)
        : undefined);

    for (const v of lockedRows) {
      const failure = checkActivation(v, now);
      if (failure) {
        return {
          ok: false,
          code: failure,
          message: messageFor(failure),
          explanations: [failureExplanation(failure, v)],
        };
      }
      const campaign = v.campaignId ? campaignById.get(v.campaignId) : undefined;
      const campaignFailure = checkCampaignActivation(campaign, input.order.currency, now);
      if (campaignFailure) {
        return {
          ok: false,
          code: campaignFailure,
          message: messageFor(campaignFailure),
          explanations: [failureExplanation(campaignFailure, v)],
        };
      }
      const customerFailure = checkCustomerBinding(v, campaign, resolvedCustomerId);
      if (customerFailure) {
        return {
          ok: false,
          code: customerFailure,
          message: messageFor(customerFailure),
          explanations: [failureExplanation(customerFailure, v)],
        };
      }
      const validationRule = campaign?.validationRuleId
        ? validationRuleById.get(campaign.validationRuleId)
        : undefined;
      const ruleFailure = checkCampaignValidationRule(
        v,
        campaign,
        validationRule,
        customer,
        input.order,
        now,
      );
      if (ruleFailure) {
        return {
          ok: false,
          code: ruleFailure.code ?? "validation_failed",
          message: ruleFailure.message ?? messageFor("validation_failed"),
          explanations: ruleFailure.explanations,
        };
      }
      // Stackable redemptions don't support gift cards yet — they need
      // partial-spend semantics that don't compose with calculateDiscount.
      if (v.type === "GIFT_CARD") {
        return {
          ok: false,
          code: "voucher_disabled",
          message: `Gift card ${v.code} cannot be stacked with discounts`,
          explanations: [
            {
              code: "gift_card_stacking_unsupported",
              message: "Gift cards cannot be stacked with discounts",
              voucherId: v.id,
              voucherCode: v.code,
              details: { type: v.type },
            },
          ],
        };
      }
    }

    const result = calculateDiscount({
      order: input.order,
      vouchers: lockedRows
        .filter((v) => v.discount)
        .map((v) => ({
          id: v.id,
          code: v.code,
          type: v.discount!.type,
          amount: v.discount!.amount,
          percent: v.discount!.percent,
          maxDiscountAmount: v.discount!.maxDiscountAmount,
          priority: v.priority,
          exclusive: v.exclusive,
          createdAt: v.createdAt.toISOString(),
        })),
    });

    if (result.appliedDiscounts.length === 0) {
      return {
        ok: false,
        code: "no_discount_effect",
        message: messageFor("no_discount_effect"),
        explanations: lockedRows.map((v) => failureExplanation("no_discount_effect", v)),
      };
    }

    const voucherById = new Map(lockedRows.map((voucher) => [voucher.id, voucher]));
    const appliedVouchers = result.appliedDiscounts.map((applied) => {
      const voucher = voucherById.get(applied.voucherId);
      if (!voucher) throw new Error("calculateDiscount returned an unknown voucherId");
      return voucher;
    });
    const customerLimitFailure = await checkStackPerUserRedemptionLimits(
      tx,
      appliedVouchers,
      campaignById,
      resolvedCustomerId,
    );
    if (customerLimitFailure) {
      return {
        ok: false,
        code: customerLimitFailure.code,
        message: messageFor(customerLimitFailure.code),
        explanations: [
          failureExplanation(
            customerLimitFailure.code,
            customerLimitFailure.voucher,
            customerLimitFailure.details,
          ),
        ],
      };
    }

    const batchId = randomUUID();
    const entries: StackEntry[] = [];
    for (const applied of result.appliedDiscounts) {
      const voucher = voucherById.get(applied.voucherId);
      if (!voucher) throw new Error("calculateDiscount returned an unknown voucherId");

      await tx
        .update(schema.voucher)
        .set({ redemptionCount: voucher.redemptionCount + 1, updatedAt: now })
        .where(eq(schema.voucher.id, voucher.id));

      const [row] = await tx
        .insert(schema.redemption)
        .values({
          voucherId: voucher.id,
          customerId: resolvedCustomerId ?? null,
          orderId: input.orderId ?? null,
          externalOrderId: input.externalOrderId ?? null,
          result: "SUCCESS",
          amount: applied.amount,
          breakdown: { breakdown: result.breakdown, finalOrder: result.finalOrder },
          idempotencyKey: input.idempotencyKey ?? null,
          batchId,
        })
        .returning({ id: schema.redemption.id });
      if (!row) throw new Error("stack redemption insert failed");

      entries.push({
        voucherCode: voucher.code,
        voucherId: voucher.id,
        redemptionId: row.id,
        amount: applied.amount,
      });
    }

    const totalAmount = result.appliedDiscounts.reduce((s, a) => s + a.amount, 0);
    await emitEvent(tx, {
      type: "voucher.stack.redeemed",
      entityId: batchId,
      payload: {
        batchId,
        customerId: resolvedCustomerId ?? null,
        orderId: input.orderId ?? null,
        externalOrderId: input.externalOrderId ?? null,
        amount: totalAmount,
        finalOrder: result.finalOrder,
        entries,
      },
    });

    return {
      ok: true,
      batchId,
      amount: totalAmount,
      finalOrder: result.finalOrder,
      breakdown: result.breakdown,
      entries,
      explanations: stackBreakdownExplanations(result.breakdown),
    };
  });
}

async function checkStackPerUserRedemptionLimits(
  tx: Tx,
  vouchers: VoucherRow[],
  campaignById: ReadonlyMap<string, RedemptionCampaignRow>,
  customerId: string | undefined,
): Promise<{
  code: "customer_required" | "per_user_redemption_limit_reached";
  voucher: VoucherRow;
  details?: Record<string, string | number | boolean | null>;
} | null> {
  const limitedVouchers = vouchers.filter((voucher) => {
    const campaign = voucher.campaignId ? campaignById.get(voucher.campaignId) : undefined;
    return voucher.perUserRedemptionLimit != null || campaign?.perUserRedemptionLimit != null;
  });
  const firstLimited = limitedVouchers[0];
  if (!firstLimited) return null;
  if (!customerId) return { code: "customer_required", voucher: firstLimited };

  const voucherIds = limitedVouchers
    .filter((voucher) => voucher.perUserRedemptionLimit != null)
    .map((voucher) => voucher.id);
  const voucherCounts = voucherIds.length
    ? await tx
        .select({
          voucherId: schema.redemption.voucherId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.redemption)
        .where(
          and(
            inArray(schema.redemption.voucherId, voucherIds),
            eq(schema.redemption.customerId, customerId),
            eq(schema.redemption.result, "SUCCESS"),
            sql`NOT EXISTS (
              SELECT 1 FROM "redemption" AS rollback
              WHERE rollback."parent_redemption_id" = ${schema.redemption.id}
                AND rollback."result" = 'ROLLBACK'
            )`,
          ),
        )
        .groupBy(schema.redemption.voucherId)
    : [];
  const voucherCountById = new Map(voucherCounts.map((row) => [row.voucherId, row.count]));

  const campaignIds = [
    ...new Set(
      limitedVouchers.flatMap((voucher) => {
        if (!voucher.campaignId) return [];
        const campaign = campaignById.get(voucher.campaignId);
        return campaign?.perUserRedemptionLimit != null ? [campaign.id] : [];
      }),
    ),
  ];
  const campaignCounts = campaignIds.length
    ? await tx
        .select({
          campaignId: schema.voucher.campaignId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.redemption)
        .innerJoin(schema.voucher, eq(schema.redemption.voucherId, schema.voucher.id))
        .where(
          and(
            inArray(schema.voucher.campaignId, campaignIds),
            eq(schema.redemption.customerId, customerId),
            eq(schema.redemption.result, "SUCCESS"),
            sql`NOT EXISTS (
              SELECT 1 FROM "redemption" AS rollback
              WHERE rollback."parent_redemption_id" = ${schema.redemption.id}
                AND rollback."result" = 'ROLLBACK'
            )`,
          ),
        )
        .groupBy(schema.voucher.campaignId)
    : [];
  const campaignCountById = new Map(
    campaignCounts.flatMap((row) => (row.campaignId ? [[row.campaignId, row.count]] : [])),
  );
  const incomingByCampaign = new Map<string, number>();

  for (const voucher of limitedVouchers) {
    if (
      voucher.perUserRedemptionLimit != null &&
      (voucherCountById.get(voucher.id) ?? 0) + 1 > voucher.perUserRedemptionLimit
    ) {
      return { code: "per_user_redemption_limit_reached", voucher };
    }

    const campaign = voucher.campaignId ? campaignById.get(voucher.campaignId) : undefined;
    if (campaign?.perUserRedemptionLimit != null) {
      const incoming = (incomingByCampaign.get(campaign.id) ?? 0) + 1;
      if ((campaignCountById.get(campaign.id) ?? 0) + incoming > campaign.perUserRedemptionLimit) {
        return {
          code: "per_user_redemption_limit_reached",
          voucher,
          details: {
            campaignId: campaign.id,
            perUserRedemptionLimit: campaign.perUserRedemptionLimit,
          },
        };
      }
      incomingByCampaign.set(campaign.id, incoming);
    }
  }

  return null;
}

async function replayBatch(tx: Tx, input: StackRedeemInput): Promise<StackRedeemResult | null> {
  if (!input.idempotencyKey) return null;
  const prior = await tx
    .select()
    .from(schema.redemption)
    .where(
      and(
        eq(schema.redemption.idempotencyKey, input.idempotencyKey),
        eq(schema.redemption.result, "SUCCESS"),
      ),
    );
  const priorBatch = prior.find((r) => r.batchId !== null);
  if (!priorBatch?.batchId) return null;

  const batch = prior.filter((r) => r.batchId === priorBatch.batchId);
  const breakdown =
    (priorBatch.breakdown as { breakdown?: DiscountResult["breakdown"] })?.breakdown ?? [];
  const finalOrder =
    (priorBatch.breakdown as { finalOrder?: DiscountResult["finalOrder"] })?.finalOrder ?? {
      amount: 0,
      currency: input.order.currency,
    };
  log.info({ batchId: priorBatch.batchId, idempotent: true }, "replaying stack redemption");
  return {
    ok: true,
    batchId: priorBatch.batchId,
    amount: batch.reduce((s, r) => s + (r.amount ?? 0), 0),
    finalOrder,
    breakdown,
    entries: batch.map((r) => ({
      voucherCode: "",
      voucherId: r.voucherId,
      redemptionId: r.id,
      amount: r.amount ?? 0,
    })),
    idempotent: true,
  };
}
