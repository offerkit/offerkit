import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import { generateUniqueCodes, BULK_INLINE_THRESHOLD } from "@open-voucherify/core/codes";
import { enqueueJob } from "@open-voucherify/core/jobs";
import { redeem, stackRedeem, validate } from "@open-voucherify/core/redemption";
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
      where: and(eq(schema.voucher.code, input.code), isNull(schema.voucher.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });
    return toVoucher(row);
  });

const create = os.vouchers.create
  .use(requireSession)
  .handler(async ({ input }) => {
    let code = input.code;
    if (!code) {
      let codeConfig: Record<string, unknown> = {};
      if (input.campaignId) {
        const campaign = await db().query.campaign.findFirst({
          where: and(
            eq(schema.campaign.id, input.campaignId),
            isNull(schema.campaign.deletedAt),
          ),
        });
        if (!campaign)
          throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
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
          discount: input.discount ?? null,
          customRewards: input.customRewards ?? [],
          giftBalance: input.giftBalance ?? null,
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
    const row = await db().transaction(async (tx) => {
      const [existing] = (await tx
        .select()
        .from(schema.voucher)
        .where(and(eq(schema.voucher.code, input.code), isNull(schema.voucher.deletedAt)))
        .limit(1)
        .for("update")) as (typeof schema.voucher.$inferSelect)[];
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Voucher not found" });

      const patch: Partial<typeof schema.voucher.$inferInsert> = { updatedAt: new Date() };
      if (input.patch.campaignId !== undefined) patch.campaignId = input.patch.campaignId ?? null;
      if (input.patch.discount !== undefined) patch.discount = input.patch.discount ?? null;
      if (input.patch.customRewards !== undefined) patch.customRewards = input.patch.customRewards;
      if (input.patch.giftBalance !== undefined) patch.giftBalance = input.patch.giftBalance ?? null;
      if (input.patch.redemptionLimit !== undefined)
        patch.redemptionLimit = input.patch.redemptionLimit ?? null;
      if (input.patch.priority !== undefined) patch.priority = input.patch.priority;
      if (input.patch.exclusive !== undefined) patch.exclusive = input.patch.exclusive;
      if (input.patch.active !== undefined) patch.active = input.patch.active;
      if (input.patch.startDate !== undefined)
        patch.startDate = input.patch.startDate ? new Date(input.patch.startDate) : null;
      if (input.patch.endDate !== undefined)
        patch.endDate = input.patch.endDate ? new Date(input.patch.endDate) : null;
      if (input.patch.customerId !== undefined) patch.customerId = input.patch.customerId ?? null;
      if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;

      const [updated] = await tx
        .update(schema.voucher)
        .set(patch)
        .where(eq(schema.voucher.id, existing.id))
        .returning();
      if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });

      if (
        existing.type === "GIFT_CARD" &&
        input.patch.giftBalance !== undefined &&
        input.patch.giftBalance !== null
      ) {
        const oldBalance = existing.giftBalance ?? 0;
        const newBalance = input.patch.giftBalance;
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
      .where(and(eq(schema.voucher.code, input.code), isNull(schema.voucher.deletedAt)))
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

    if (campaign.type === "LOYALTY_PROGRAM") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Loyalty programs use members + points, not voucher codes",
      });
    }

    if (input.count > BULK_INLINE_THRESHOLD) {
      const jobId = await enqueueJob(db(), "bulk_codes.generate", {
        campaignId: campaign.id,
        count: input.count,
      });
      return { campaignId: campaign.id, generated: 0, jobId };
    }

    const codes = await generateUniqueCodes(
      input.count,
      (campaign.codeConfig ?? {}) as Record<string, unknown>,
      codeExists,
    );

    const type: "DISCOUNT" | "GIFT_CARD" =
      campaign.type === "GIFT_VOUCHERS" ? "GIFT_CARD" : "DISCOUNT";

    await db()
      .insert(schema.voucher)
      .values(codes.map((code) => ({ code, campaignId: campaign.id, type })));

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
      voucherCode: input.code,
      customerId: input.customerId,
      order: input.order,
    });
    return {
      valid: result.valid,
      code: result.code,
      message: result.message,
      preview: result.preview,
    };
  });

const redeemProc = os.vouchers.redeem
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await redeem(db(), {
      voucherCode: input.code,
      customerId: input.customerId,
      order: input.order,
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
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
    return { ok: false, code: result.code, message: result.message };
  });

const transactions = os.vouchers.transactions
  .use(requireSession)
  .handler(async ({ input }) => {
    const voucher = await db().query.voucher.findFirst({
      where: and(eq(schema.voucher.code, input.code), isNull(schema.voucher.deletedAt)),
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
        idempotent: result.idempotent,
      };
    }
    return { ok: false, code: result.code, message: result.message };
  });

export const vouchersRouter = {
  list,
  get,
  create,
  update,
  delete: remove,
  bulk,
  validate: validateProc,
  redeem: redeemProc,
  stackRedeem: stackRedeemProc,
  transactions,
};
