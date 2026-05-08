import { ORPCError, implement } from "@orpc/server";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import {
  earn as earnPoints,
  redeemReward,
  listHistory,
} from "@open-voucherify/core/loyalty";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import { decodeCursor, encodeCursor } from "./helpers";

const os = implement(contract).$context<RequestContext>();

type ProgramRow = typeof schema.loyaltyProgram.$inferSelect;
type TierRow = typeof schema.loyaltyTier.$inferSelect;
type EarningRuleRow = typeof schema.loyaltyEarningRule.$inferSelect;
type RewardRow = typeof schema.loyaltyReward.$inferSelect;
type MemberRow = typeof schema.loyaltyMember.$inferSelect;
type TransactionRow = typeof schema.loyaltyTransaction.$inferSelect;

function toProgram(row: ProgramRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    pointsExpiryDays: row.pointsExpiryDays,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTier(row: TierRow) {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    threshold: row.threshold,
    earnMultiplier: row.earnMultiplier,
    sortOrder: row.sortOrder,
  };
}

function toEarningRule(row: EarningRuleRow) {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    event: row.event,
    validationRuleId: row.validationRuleId,
    formula: row.formula,
    active: row.active,
  };
}

function toReward(row: RewardRow) {
  return {
    id: row.id,
    programId: row.programId,
    name: row.name,
    description: row.description,
    cost: row.cost,
    payload: row.payload,
  };
}

function toMember(row: MemberRow) {
  return {
    id: row.id,
    customerId: row.customerId,
    programId: row.programId,
    balance: row.balance,
    lifetimePoints: row.lifetimePoints,
    currentTierId: row.currentTierId,
    enrolledAt: row.enrolledAt.toISOString(),
  };
}

function toTransaction(row: TransactionRow) {
  return {
    id: row.id,
    memberId: row.memberId,
    delta: row.delta,
    balanceAfter: row.balanceAfter,
    reason: row.reason,
    rewardId: row.rewardId,
    earningRuleId: row.earningRuleId,
    eventId: row.eventId,
    note: row.note,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const programsList = os.loyalty.programs.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const filters = [isNull(schema.loyaltyProgram.deletedAt)];
    if (cursor) {
      filters.push(
        sql`(${schema.loyaltyProgram.createdAt}, ${schema.loyaltyProgram.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }
    const rows = (await db()
      .select()
      .from(schema.loyaltyProgram)
      .where(and(...filters))
      .orderBy(desc(schema.loyaltyProgram.createdAt), desc(schema.loyaltyProgram.id))
      .limit(limit + 1)) as ProgramRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toProgram),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const programGet = os.loyalty.programs.get.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.loyaltyProgram.findFirst({
    where: and(eq(schema.loyaltyProgram.id, input.id), isNull(schema.loyaltyProgram.deletedAt)),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Loyalty program not found" });
  return toProgram(row);
});

const programCreate = os.loyalty.programs.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const campaign = await db().query.campaign.findFirst({
      where: and(
        eq(schema.campaign.id, input.campaignId),
        isNull(schema.campaign.deletedAt),
      ),
    });
    if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    if (campaign.type !== "LOYALTY_PROGRAM") {
      throw new ORPCError("BAD_REQUEST", { message: "Campaign type must be LOYALTY_PROGRAM" });
    }
    const [row] = await db()
      .insert(schema.loyaltyProgram)
      .values({
        campaignId: input.campaignId,
        pointsExpiryDays: input.pointsExpiryDays ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toProgram(row);
  });

const programUpdate = os.loyalty.programs.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.loyaltyProgram.$inferInsert> = { updatedAt: new Date() };
    if (input.patch.pointsExpiryDays !== undefined)
      patch.pointsExpiryDays = input.patch.pointsExpiryDays ?? null;
    if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;
    const [row] = await db()
      .update(schema.loyaltyProgram)
      .set(patch)
      .where(
        and(
          eq(schema.loyaltyProgram.id, input.id),
          isNull(schema.loyaltyProgram.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Loyalty program not found" });
    return toProgram(row);
  });

const programDelete = os.loyalty.programs.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.loyaltyProgram)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.loyaltyProgram.id, input.id),
          isNull(schema.loyaltyProgram.deletedAt),
        ),
      )
      .returning({ id: schema.loyaltyProgram.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Loyalty program not found" });
    return { ok: true as const };
  });

const tiersList = os.loyalty.tiers.list.use(requireSession).handler(async ({ input }) => {
  const rows = (await db()
    .select()
    .from(schema.loyaltyTier)
    .where(eq(schema.loyaltyTier.programId, input.programId))
    .orderBy(asc(schema.loyaltyTier.threshold))) as TierRow[];
  return { data: rows.map(toTier) };
});

const tiersCreate = os.loyalty.tiers.create.use(requireSession).handler(async ({ input }) => {
  const [row] = await db()
    .insert(schema.loyaltyTier)
    .values({
      programId: input.programId,
      name: input.name,
      threshold: input.threshold,
      earnMultiplier: input.earnMultiplier,
      sortOrder: input.sortOrder,
    })
    .returning();
  if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
  return toTier(row);
});

const tiersUpdate = os.loyalty.tiers.update.use(requireSession).handler(async ({ input }) => {
  const patch: Partial<typeof schema.loyaltyTier.$inferInsert> = { updatedAt: new Date() };
  if (input.patch.name !== undefined) patch.name = input.patch.name;
  if (input.patch.threshold !== undefined) patch.threshold = input.patch.threshold;
  if (input.patch.earnMultiplier !== undefined) patch.earnMultiplier = input.patch.earnMultiplier;
  if (input.patch.sortOrder !== undefined) patch.sortOrder = input.patch.sortOrder;
  const [row] = await db()
    .update(schema.loyaltyTier)
    .set(patch)
    .where(eq(schema.loyaltyTier.id, input.id))
    .returning();
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Tier not found" });
  return toTier(row);
});

const tiersDelete = os.loyalty.tiers.delete.use(requireSession).handler(async ({ input }) => {
  const [row] = await db()
    .delete(schema.loyaltyTier)
    .where(eq(schema.loyaltyTier.id, input.id))
    .returning({ id: schema.loyaltyTier.id });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Tier not found" });
  return { ok: true as const };
});

const earningRulesList = os.loyalty.earningRules.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const rows = (await db()
      .select()
      .from(schema.loyaltyEarningRule)
      .where(eq(schema.loyaltyEarningRule.programId, input.programId))
      .orderBy(desc(schema.loyaltyEarningRule.createdAt))) as EarningRuleRow[];
    return { data: rows.map(toEarningRule) };
  });

const earningRulesCreate = os.loyalty.earningRules.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.loyaltyEarningRule)
      .values({
        programId: input.programId,
        name: input.name,
        event: input.event,
        validationRuleId: input.validationRuleId ?? null,
        formula: input.formula,
        active: input.active ?? "yes",
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toEarningRule(row);
  });

const earningRulesUpdate = os.loyalty.earningRules.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.loyaltyEarningRule.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.patch.name !== undefined) patch.name = input.patch.name;
    if (input.patch.event !== undefined) patch.event = input.patch.event;
    if (input.patch.validationRuleId !== undefined)
      patch.validationRuleId = input.patch.validationRuleId ?? null;
    if (input.patch.formula !== undefined) patch.formula = input.patch.formula;
    if (input.patch.active !== undefined) patch.active = input.patch.active;
    const [row] = await db()
      .update(schema.loyaltyEarningRule)
      .set(patch)
      .where(eq(schema.loyaltyEarningRule.id, input.id))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Earning rule not found" });
    return toEarningRule(row);
  });

const earningRulesDelete = os.loyalty.earningRules.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .delete(schema.loyaltyEarningRule)
      .where(eq(schema.loyaltyEarningRule.id, input.id))
      .returning({ id: schema.loyaltyEarningRule.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Earning rule not found" });
    return { ok: true as const };
  });

const rewardsList = os.loyalty.rewards.list.use(requireSession).handler(async ({ input }) => {
  const rows = (await db()
    .select()
    .from(schema.loyaltyReward)
    .where(
      and(
        eq(schema.loyaltyReward.programId, input.programId),
        isNull(schema.loyaltyReward.deletedAt),
      ),
    )
    .orderBy(asc(schema.loyaltyReward.cost))) as RewardRow[];
  return { data: rows.map(toReward) };
});

const rewardsCreate = os.loyalty.rewards.create.use(requireSession).handler(async ({ input }) => {
  const [row] = await db()
    .insert(schema.loyaltyReward)
    .values({
      programId: input.programId,
      name: input.name,
      description: input.description ?? null,
      cost: input.cost,
      payload: input.payload,
    })
    .returning();
  if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
  return toReward(row);
});

const rewardsUpdate = os.loyalty.rewards.update.use(requireSession).handler(async ({ input }) => {
  const patch: Partial<typeof schema.loyaltyReward.$inferInsert> = { updatedAt: new Date() };
  if (input.patch.name !== undefined) patch.name = input.patch.name;
  if (input.patch.description !== undefined)
    patch.description = input.patch.description ?? null;
  if (input.patch.cost !== undefined) patch.cost = input.patch.cost;
  if (input.patch.payload !== undefined) patch.payload = input.patch.payload;
  const [row] = await db()
    .update(schema.loyaltyReward)
    .set(patch)
    .where(
      and(eq(schema.loyaltyReward.id, input.id), isNull(schema.loyaltyReward.deletedAt)),
    )
    .returning();
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Reward not found" });
  return toReward(row);
});

const rewardsDelete = os.loyalty.rewards.delete.use(requireSession).handler(async ({ input }) => {
  const [row] = await db()
    .update(schema.loyaltyReward)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(schema.loyaltyReward.id, input.id), isNull(schema.loyaltyReward.deletedAt)),
    )
    .returning({ id: schema.loyaltyReward.id });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Reward not found" });
  return { ok: true as const };
});

const membersList = os.loyalty.members.list.use(requireSession).handler(async ({ input }) => {
  const limit = input.limit;
  const cursor = decodeCursor(input.cursor);
  const filters = [eq(schema.loyaltyMember.programId, input.programId)];
  if (cursor) {
    filters.push(
      sql`(${schema.loyaltyMember.createdAt}, ${schema.loyaltyMember.id}) < (${cursor.createdAt}, ${cursor.id})`,
    );
  }
  const rows = (await db()
    .select()
    .from(schema.loyaltyMember)
    .where(and(...filters))
    .orderBy(desc(schema.loyaltyMember.createdAt), desc(schema.loyaltyMember.id))
    .limit(limit + 1)) as MemberRow[];
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data[data.length - 1];
  return {
    data: data.map(toMember),
    next:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : undefined,
  };
});

const membersGet = os.loyalty.members.get.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.loyaltyMember.findFirst({
    where: eq(schema.loyaltyMember.id, input.id),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Member not found" });
  return toMember(row);
});

const membersEnroll = os.loyalty.members.enroll
  .use(requireSession)
  .handler(async ({ input }) => {
    const existing = await db().query.loyaltyMember.findFirst({
      where: and(
        eq(schema.loyaltyMember.customerId, input.customerId),
        eq(schema.loyaltyMember.programId, input.programId),
      ),
    });
    if (existing) return toMember(existing);
    const [row] = await db()
      .insert(schema.loyaltyMember)
      .values({ customerId: input.customerId, programId: input.programId })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Enroll failed" });
    return toMember(row);
  });

const membersEarn = os.loyalty.members.earn.use(requireSession).handler(async ({ input }) => {
  const result = await earnPoints(db(), {
    memberId: input.memberId,
    basePoints: input.basePoints,
    earningRuleId: input.earningRuleId,
    eventId: input.eventId,
    note: input.note,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    applyMultiplier: input.applyMultiplier,
  });
  if (!result.ok || !result.data) {
    return { ok: false, code: result.code, message: result.message };
  }
  return {
    ok: true,
    transactionId: result.data.transactionId,
    delta: result.data.delta,
    balance: result.data.balance,
    lifetimePoints: result.data.lifetimePoints,
    tierId: result.data.tierId,
  };
});

const membersAdjust = os.loyalty.members.adjust
  .use(requireSession)
  .handler(async ({ input }) => {
    if (input.delta === 0) {
      return { ok: false, code: "validation_error", message: "delta must be non-zero" };
    }
    if (input.delta > 0) {
      const result = await earnPoints(db(), {
        memberId: input.memberId,
        basePoints: input.delta,
        reason: "ADJUSTMENT",
        applyMultiplier: false,
        note: input.note,
      });
      if (!result.ok || !result.data) {
        return { ok: false, code: result.code, message: result.message };
      }
      return { ok: true, transactionId: result.data.transactionId, balance: result.data.balance };
    }
    // Negative adjustment uses rollback-style insert via earn with negative path.
    // Implement directly via a manual ledger row.
    const r = await db().transaction(async (tx) => {
      const [member] = (await tx
        .select()
        .from(schema.loyaltyMember)
        .where(eq(schema.loyaltyMember.id, input.memberId))
        .limit(1)
        .for("update")) as MemberRow[];
      if (!member) return null;
      const newBalance = member.balance + input.delta;
      const [txRow] = await tx
        .insert(schema.loyaltyTransaction)
        .values({
          memberId: member.id,
          delta: input.delta,
          balanceAfter: newBalance,
          reason: "ADJUSTMENT",
          note: input.note ?? null,
        })
        .returning({ id: schema.loyaltyTransaction.id });
      if (!txRow) throw new Error("adjust insert failed");
      await tx
        .update(schema.loyaltyMember)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(schema.loyaltyMember.id, member.id));
      return { transactionId: txRow.id, balance: newBalance };
    });
    if (!r) return { ok: false, code: "member_not_found", message: "Member not found" };
    return { ok: true, transactionId: r.transactionId, balance: r.balance };
  });

const membersRedeem = os.loyalty.members.redeem
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await redeemReward(db(), input);
    if (!result.ok || !result.data) {
      return { ok: false, code: result.code, message: result.message };
    }
    return {
      ok: true,
      transactionId: result.data.transactionId,
      rewardId: result.data.rewardId,
      cost: result.data.cost,
      balance: result.data.balance,
      payload: result.data.payload as unknown as Record<string, unknown>,
    };
  });

const membersHistory = os.loyalty.members.history
  .use(requireSession)
  .handler(async ({ input }) => {
    const rows = await listHistory(db(), input.id);
    return { data: rows.map(toTransaction) };
  });

export const loyaltyRouter = {
  programs: {
    list: programsList,
    get: programGet,
    create: programCreate,
    update: programUpdate,
    delete: programDelete,
  },
  tiers: {
    list: tiersList,
    create: tiersCreate,
    update: tiersUpdate,
    delete: tiersDelete,
  },
  earningRules: {
    list: earningRulesList,
    create: earningRulesCreate,
    update: earningRulesUpdate,
    delete: earningRulesDelete,
  },
  rewards: {
    list: rewardsList,
    create: rewardsCreate,
    update: rewardsUpdate,
    delete: rewardsDelete,
  },
  members: {
    list: membersList,
    get: membersGet,
    enroll: membersEnroll,
    earn: membersEarn,
    adjust: membersAdjust,
    redeem: membersRedeem,
    history: membersHistory,
  },
};
