import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import type { VoucherDiscount } from "@offerkit/db/schema";
import { contract } from "@offerkit/contract/router";
import { generateUniqueCodes, BULK_INLINE_THRESHOLD } from "@offerkit/core/codes";
import { enqueueJob } from "@offerkit/core/jobs";
import { qualify, redeem, stackRedeem, validate } from "@offerkit/core/redemption";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  toVoucher,
  type VoucherRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

async function codeExists(code: string): Promise<boolean> {
  const row = await db().query.voucher.findFirst({
    where: eq(schema.voucher.code, code),
    columns: { id: true },
  });
  return row !== undefined;
}

async function generateUnique(config: Record<string, unknown> | undefined): Promise<string> {
  const codes = await generateUniqueCodes(1, config ?? {}, codeExists);
  const code = codes[0];
  if (!code) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Code generation failed" });
  return code;
}

type CampaignRow = typeof schema.campaign.$inferSelect;
type VoucherInputType = "DISCOUNT" | "GIFT_CARD";
type VoucherDiscountInput = VoucherDiscount;

function voucherTypeForCampaign(campaign: CampaignRow): VoucherInputType {
  return campaign.type === "GIFT_VOUCHERS" ? "GIFT_CARD" : "DISCOUNT";
}

function assertCampaignAllowsVoucher(campaign: CampaignRow, voucherType: VoucherInputType): void {
  if (campaign.type === "GIFT_VOUCHERS" && voucherType !== "GIFT_CARD") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Gift voucher campaigns can only issue gift cards",
    });
  }
  if (campaign.type === "DISCOUNT" && voucherType !== "DISCOUNT") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Discount campaigns can only issue discount vouchers",
    });
  }
  if (campaign.type === "LOYALTY_PROGRAM" || campaign.type === "PROMOTION") {
    throw new ORPCError("BAD_REQUEST", {
      message: `${campaign.type} campaigns do not issue voucher codes`,
    });
  }
}

function assertCampaignAllowsBulk(campaign: CampaignRow): void {
  if (campaign.type === "REFERRAL_PROGRAM") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Referral programs issue codes from the referral page",
    });
  }
  assertCampaignAllowsVoucher(campaign, voucherTypeForCampaign(campaign));
}

function discountHasValue(discount: VoucherDiscountInput | null | undefined): boolean {
  if (!discount) return false;
  if (discount.type === "AMOUNT") return (discount.amount ?? 0) > 0;
  return (discount.percent ?? 0) > 0;
}

function assertVoucherHasValue(input: {
  type: VoucherInputType;
  discount?: VoucherDiscountInput | null;
  customRewards?: unknown[];
  giftBalance?: number | null;
}): void {
  if (input.type === "GIFT_CARD" && (input.giftBalance ?? 0) <= 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Gift cards require a positive starting balance",
    });
  }
  if (
    input.type === "DISCOUNT" &&
    !discountHasValue(input.discount) &&
    (input.customRewards?.length ?? 0) === 0
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Discount vouchers require a positive discount or custom reward",
    });
  }
}

const list = os.vouchers.list
  .use(requireSession)
  .handler(({ input }) => {
    const search = input.search?.trim();
    const filters = [];
    if (search) filters.push(ilike(schema.voucher.code, `%${search}%`));
    if (input.campaignId) filters.push(eq(schema.voucher.campaignId, input.campaignId));
    if (input.customerId) filters.push(eq(schema.voucher.customerId, input.customerId));
    if (input.active !== undefined) filters.push(eq(schema.voucher.active, input.active));
    return paginatedSoftDeleteList<VoucherRow, ReturnType<typeof toVoucher>>({
      table: schema.voucher,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters,
      toOutput: toVoucher,
    });
  });

const get = os.vouchers.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.voucher.findFirst({
      where: and(eq(schema.voucher.code, input.params.code), isNull(schema.voucher.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });
    return toVoucher(row);
  });

const create = os.vouchers.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const campaign = input.campaignId
      ? await db().query.campaign.findFirst({
          where: and(eq(schema.campaign.id, input.campaignId), isNull(schema.campaign.deletedAt)),
        })
      : undefined;
    if (input.campaignId && !campaign) {
      throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    }
    if (campaign) assertCampaignAllowsVoucher(campaign, input.type);
    assertVoucherHasValue({
      type: input.type,
      discount: input.discount,
      customRewards: input.customRewards,
      giftBalance: input.giftBalance,
    });

    let code = input.code;
    if (!code) {
      let codeConfig: Record<string, unknown> = {};
      if (campaign) {
        codeConfig = (campaign.codeConfig ?? {}) as Record<string, unknown>;
      }
      code = await generateUnique(codeConfig);
    } else if (await codeExists(code)) {
      throw new ORPCError("CONFLICT", { message: "Voucher code already exists" });
    }

    const row = await db().transaction(async (tx) => {
      const [v] = await tx
        .insert(schema.voucher)
        .values({
          code,
          campaignId: input.campaignId ?? null,
          type: input.type,
          discount: input.type === "DISCOUNT" ? (input.discount ?? null) : null,
          customRewards: input.customRewards ?? [],
          giftBalance: input.type === "GIFT_CARD" ? (input.giftBalance ?? null) : null,
          redemptionLimit: input.redemptionLimit ?? null,
          priority: input.priority ?? 0,
          exclusive: input.exclusive ?? false,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          customerId: input.customerId ?? null,
          metadata: input.metadata ?? {},
        })
        .returning();
      if (!v) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });

      if (input.type === "GIFT_CARD" && input.giftBalance != null && input.giftBalance > 0) {
        await tx.insert(schema.giftCardTransaction).values({
          voucherId: v.id,
          delta: input.giftBalance,
          balanceAfter: input.giftBalance,
          reason: "CREDIT",
        });
      }

      if (input.campaignId) {
        await tx
          .update(schema.campaign)
          .set({
            voucherCount: sql`${schema.campaign.voucherCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.campaign.id, input.campaignId));
      }
      return v;
    });

    return toVoucher(row);
  });

const update = os.vouchers.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const { patch: inputPatch } = input.body;
    const row = await db().transaction(async (tx) => {
      const [existing] = (await tx
        .select()
        .from(schema.voucher)
        .where(and(eq(schema.voucher.code, input.params.code), isNull(schema.voucher.deletedAt)))
        .limit(1)
        .for("update")) as (typeof schema.voucher.$inferSelect)[];
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });

      const patch: Partial<typeof schema.voucher.$inferInsert> = { updatedAt: new Date() };
      if (inputPatch.campaignId !== undefined) patch.campaignId = inputPatch.campaignId ?? null;
      const nextCampaignId =
        inputPatch.campaignId !== undefined ? (inputPatch.campaignId ?? null) : existing.campaignId;
      if (nextCampaignId) {
        const campaign = await tx.query.campaign.findFirst({
          where: and(eq(schema.campaign.id, nextCampaignId), isNull(schema.campaign.deletedAt)),
        });
        if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
        assertCampaignAllowsVoucher(campaign, existing.type);
      }

      const nextDiscount =
        inputPatch.discount !== undefined ? (inputPatch.discount ?? null) : existing.discount;
      const nextCustomRewards =
        inputPatch.customRewards !== undefined
          ? inputPatch.customRewards
          : existing.customRewards;
      const nextGiftBalance =
        inputPatch.giftBalance !== undefined
          ? (inputPatch.giftBalance ?? null)
          : existing.giftBalance;
      const valueChanged =
        inputPatch.campaignId !== undefined ||
        (existing.type === "DISCOUNT" &&
          (inputPatch.discount !== undefined || inputPatch.customRewards !== undefined)) ||
        (existing.type === "GIFT_CARD" &&
          inputPatch.giftBalance !== undefined &&
          inputPatch.giftBalance !== existing.giftBalance);
      if (valueChanged) {
        assertVoucherHasValue({
          type: existing.type,
          discount: existing.type === "DISCOUNT" ? nextDiscount : null,
          customRewards: nextCustomRewards,
          giftBalance: existing.type === "GIFT_CARD" ? nextGiftBalance : null,
        });
      }

      if (inputPatch.discount !== undefined && existing.type === "DISCOUNT") {
        patch.discount = inputPatch.discount ?? null;
      }
      if (inputPatch.customRewards !== undefined) patch.customRewards = inputPatch.customRewards;
      if (inputPatch.giftBalance !== undefined && existing.type === "GIFT_CARD") {
        patch.giftBalance = inputPatch.giftBalance ?? null;
      }
      if (inputPatch.redemptionLimit !== undefined)
        patch.redemptionLimit = inputPatch.redemptionLimit ?? null;
      if (inputPatch.priority !== undefined) patch.priority = inputPatch.priority;
      if (inputPatch.exclusive !== undefined) patch.exclusive = inputPatch.exclusive;
      if (inputPatch.active !== undefined) patch.active = inputPatch.active;
      if (inputPatch.startDate !== undefined)
        patch.startDate = inputPatch.startDate ? new Date(inputPatch.startDate) : null;
      if (inputPatch.endDate !== undefined)
        patch.endDate = inputPatch.endDate ? new Date(inputPatch.endDate) : null;
      if (inputPatch.customerId !== undefined) patch.customerId = inputPatch.customerId ?? null;
      if (inputPatch.metadata !== undefined) patch.metadata = inputPatch.metadata;

      const [updated] = await tx
        .update(schema.voucher)
        .set(patch)
        .where(eq(schema.voucher.id, existing.id))
        .returning();
      if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });

      if (
        existing.type === "GIFT_CARD" &&
        inputPatch.giftBalance !== undefined &&
        inputPatch.giftBalance !== null
      ) {
        const oldBalance = existing.giftBalance ?? 0;
        const newBalance = inputPatch.giftBalance;
        const delta = newBalance - oldBalance;
        if (delta !== 0) {
          await tx.insert(schema.giftCardTransaction).values({
            voucherId: existing.id,
            delta,
            balanceAfter: newBalance,
            reason: oldBalance === 0 ? "CREDIT" : "ADJUSTMENT",
          });
        }
      }

      return updated;
    });

    return toVoucher(row);
  });

const remove = os.vouchers.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.voucher)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.voucher.code, input.params.code), isNull(schema.voucher.deletedAt)))
      .returning({ id: schema.voucher.id, campaignId: schema.voucher.campaignId });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });
    if (row.campaignId) {
      await db()
        .update(schema.campaign)
        .set({
          voucherCount: sql`GREATEST(${schema.campaign.voucherCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaign.id, row.campaignId));
    }
    return { ok: true as const };
  });

const bulk = os.vouchers.bulk
  .use(requireSession)
  .handler(async ({ input }) => {
    const campaign = await db().query.campaign.findFirst({
      where: and(
        eq(schema.campaign.id, input.campaignId),
        isNull(schema.campaign.deletedAt),
      ),
    });
    if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });

    assertCampaignAllowsBulk(campaign);
    const type = voucherTypeForCampaign(campaign);
    assertVoucherHasValue({
      type,
      discount: input.discount,
      giftBalance: input.giftBalance,
    });

    if (input.count > BULK_INLINE_THRESHOLD) {
      const jobId = await enqueueJob(db(), "bulk_codes.generate", {
        campaignId: campaign.id,
        count: input.count,
        discount: input.discount,
        giftBalance: input.giftBalance,
      });
      return { campaignId: campaign.id, generated: 0, jobId };
    }

    const codes = await generateUniqueCodes(
      input.count,
      (campaign.codeConfig ?? {}) as Record<string, unknown>,
      codeExists,
    );

    await db()
      .insert(schema.voucher)
      .values(
        codes.map((code) => ({
          code,
          campaignId: campaign.id,
          type,
          discount: type === "DISCOUNT" ? input.discount : null,
          giftBalance: type === "GIFT_CARD" ? input.giftBalance : null,
        })),
      );

    if (type === "GIFT_CARD" && input.giftBalance) {
      const giftBalance = input.giftBalance;
      const inserted = await db()
        .select({ id: schema.voucher.id })
        .from(schema.voucher)
        .where(and(eq(schema.voucher.campaignId, campaign.id), inArray(schema.voucher.code, codes)));
      if (inserted.length > 0) {
        await db().insert(schema.giftCardTransaction).values(
          inserted.map((v) => ({
            voucherId: v.id,
            delta: giftBalance,
            balanceAfter: giftBalance,
            reason: "CREDIT" as const,
          })),
        );
      }
    }

    await db()
      .update(schema.campaign)
      .set({
        voucherCount: sql`${schema.campaign.voucherCount} + ${codes.length}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaign.id, campaign.id));

    return { campaignId: campaign.id, generated: codes.length };
  });

const validateProc = os.vouchers.validate
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await validate(db(), {
      voucherCode: input.params.code,
      customerId: input.body?.customerId,
      order: input.body?.order,
    });
    return {
      valid: result.valid,
      code: result.code,
      message: result.message,
      explanations: result.explanations,
      preview: result.preview,
    };
  });

const qualifyProc = os.vouchers.qualify
  .use(requireSession)
  .handler(({ input }) => qualify(db(), input));

const redeemProc = os.vouchers.redeem
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await redeem(db(), {
      voucherCode: input.params.code,
      customerId: input.body?.customerId,
      order: input.body?.order,
      orderId: input.body?.orderId,
      externalOrderId: input.body?.externalOrderId,
      idempotencyKey: input.body?.idempotencyKey,
    });
    if (result.ok) {
      return {
        ok: true,
        redemptionId: result.redemptionId,
        amount: result.amount,
        finalOrder: result.finalOrder,
        breakdown: result.breakdown,
        idempotent: result.idempotent,
      };
    }
    return {
      ok: false,
      code: result.code,
      message: result.message,
      explanations: result.explanations,
    };
  });

const transactions = os.vouchers.transactions
  .use(requireSession)
  .handler(async ({ input }) => {
    const voucher = await db().query.voucher.findFirst({
      where: and(eq(schema.voucher.code, input.params.code), isNull(schema.voucher.deletedAt)),
      columns: { id: true },
    });
    if (!voucher) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });

    const rows = await db().query.giftCardTransaction.findMany({
      where: eq(schema.giftCardTransaction.voucherId, voucher.id),
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit: 200,
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        redemptionId: r.redemptionId,
        delta: r.delta,
        balanceAfter: r.balanceAfter,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

const stackRedeemProc = os.vouchers.stackRedeem
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await stackRedeem(db(), {
      voucherCodes: input.codes,
      customerId: input.customerId,
      orderId: input.orderId,
      externalOrderId: input.externalOrderId,
      order: input.order,
      idempotencyKey: input.idempotencyKey,
    });
    if (result.ok) {
      return {
        ok: true,
        batchId: result.batchId,
        amount: result.amount,
        finalOrder: result.finalOrder,
        breakdown: result.breakdown,
        entries: result.entries,
        explanations: result.explanations,
        idempotent: result.idempotent,
      };
    }
    return {
      ok: false,
      code: result.code,
      message: result.message,
      explanations: result.explanations,
    };
  });

export const vouchersRouter = {
  list,
  get,
  create,
  update,
  delete: remove,
  bulk,
  validate: validateProc,
  qualify: qualifyProc,
  redeem: redeemProc,
  stackRedeem: stackRedeemProc,
  transactions,
};
