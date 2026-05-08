import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { schema, type Db } from "@open-voucherify/db";
import { logger } from "../observability/index.ts";

const log = logger.child({ component: "loyalty" });

export type LoyaltyFailureCode =
  | "member_not_found"
  | "reward_not_found"
  | "reward_unavailable"
  | "insufficient_points"
  | "program_not_found"
  | "transaction_not_found";

export interface LoyaltyResult<T> {
  ok: boolean;
  data?: T;
  code?: LoyaltyFailureCode;
  message?: string;
}

interface MemberRow {
  id: string;
  customerId: string;
  programId: string;
  balance: number;
  lifetimePoints: number;
  currentTierId: string | null;
}

interface TierRow {
  id: string;
  programId: string;
  name: string;
  threshold: number;
  earnMultiplier: number;
  sortOrder: number;
}

function pickTier(tiers: TierRow[], lifetimePoints: number): TierRow | null {
  // tiers sorted by threshold ascending; pick the highest one whose threshold <= lifetimePoints.
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let chosen: TierRow | null = null;
  for (const t of sorted) {
    if (t.threshold <= lifetimePoints) chosen = t;
    else break;
  }
  return chosen;
}

export interface EarnInput {
  memberId: string;
  basePoints: number;
  reason?: "EARN" | "ADJUSTMENT";
  earningRuleId?: string;
  eventId?: string;
  note?: string;
  expiresAt?: Date;
  /**
   * If true, apply the member's current tier earnMultiplier to basePoints.
   * Adjustments (manual edits) typically pass false.
   */
  applyMultiplier?: boolean;
}

export async function earn(db: Db, input: EarnInput): Promise<LoyaltyResult<{
  transactionId: string;
  delta: number;
  balance: number;
  lifetimePoints: number;
  tierId: string | null;
}>> {
  if (input.basePoints <= 0) {
    return { ok: false, code: "insufficient_points", message: "Base points must be positive" };
  }

  return db.transaction(async (tx) => {
    const [member] = (await tx
      .select()
      .from(schema.loyaltyMember)
      .where(eq(schema.loyaltyMember.id, input.memberId))
      .limit(1)
      .for("update")) as MemberRow[];
    if (!member) {
      return { ok: false, code: "member_not_found", message: "Loyalty member not found" };
    }

    const tiers = (await tx
      .select()
      .from(schema.loyaltyTier)
      .where(eq(schema.loyaltyTier.programId, member.programId))
      .orderBy(asc(schema.loyaltyTier.threshold))) as TierRow[];

    const currentTier = member.currentTierId
      ? tiers.find((t) => t.id === member.currentTierId) ?? null
      : null;
    const multiplier =
      input.applyMultiplier !== false && currentTier ? currentTier.earnMultiplier : 10000;
    const delta = Math.floor((input.basePoints * multiplier) / 10000);
    const reason = input.reason ?? "EARN";

    const newBalance = member.balance + delta;
    const newLifetime = reason === "EARN" ? member.lifetimePoints + delta : member.lifetimePoints;
    const nextTier = pickTier(tiers, newLifetime);

    const [txRow] = await tx
      .insert(schema.loyaltyTransaction)
      .values({
        memberId: member.id,
        delta,
        balanceAfter: newBalance,
        reason,
        earningRuleId: input.earningRuleId ?? null,
        eventId: input.eventId ?? null,
        note: input.note ?? null,
        expiresAt: input.expiresAt ?? null,
      })
      .returning({ id: schema.loyaltyTransaction.id });
    if (!txRow) throw new Error("loyalty earn insert failed");

    await tx
      .update(schema.loyaltyMember)
      .set({
        balance: newBalance,
        lifetimePoints: newLifetime,
        currentTierId: nextTier?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyMember.id, member.id));

    log.info(
      {
        memberId: member.id,
        delta,
        balance: newBalance,
        tierId: nextTier?.id ?? null,
      },
      "loyalty earn",
    );

    return {
      ok: true,
      data: {
        transactionId: txRow.id,
        delta,
        balance: newBalance,
        lifetimePoints: newLifetime,
        tierId: nextTier?.id ?? null,
      },
    };
  });
}

export interface RedeemRewardInput {
  memberId: string;
  rewardId: string;
  note?: string;
}

export interface RewardOutcome {
  transactionId: string;
  rewardId: string;
  cost: number;
  balance: number;
  payload: typeof schema.loyaltyReward.$inferSelect.payload;
}

export async function redeemReward(
  db: Db,
  input: RedeemRewardInput,
): Promise<LoyaltyResult<RewardOutcome>> {
  return db.transaction(async (tx) => {
    const [member] = (await tx
      .select()
      .from(schema.loyaltyMember)
      .where(eq(schema.loyaltyMember.id, input.memberId))
      .limit(1)
      .for("update")) as MemberRow[];
    if (!member) {
      return { ok: false, code: "member_not_found", message: "Loyalty member not found" };
    }

    const reward = await tx.query.loyaltyReward.findFirst({
      where: and(
        eq(schema.loyaltyReward.id, input.rewardId),
        eq(schema.loyaltyReward.programId, member.programId),
        isNull(schema.loyaltyReward.deletedAt),
      ),
    });
    if (!reward) {
      return { ok: false, code: "reward_not_found", message: "Reward not found in this program" };
    }
    if (member.balance < reward.cost) {
      return {
        ok: false,
        code: "insufficient_points",
        message: `Need ${String(reward.cost)} points, have ${String(member.balance)}`,
      };
    }

    const newBalance = member.balance - reward.cost;
    const [txRow] = await tx
      .insert(schema.loyaltyTransaction)
      .values({
        memberId: member.id,
        delta: -reward.cost,
        balanceAfter: newBalance,
        reason: "REDEEM",
        rewardId: reward.id,
        note: input.note ?? null,
      })
      .returning({ id: schema.loyaltyTransaction.id });
    if (!txRow) throw new Error("loyalty redeem insert failed");

    await tx
      .update(schema.loyaltyMember)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.loyaltyMember.id, member.id));

    return {
      ok: true,
      data: {
        transactionId: txRow.id,
        rewardId: reward.id,
        cost: reward.cost,
        balance: newBalance,
        payload: reward.payload,
      },
    };
  });
}

export interface RollbackInput {
  transactionId: string;
  note?: string;
}

export async function rollbackTransaction(
  db: Db,
  input: RollbackInput,
): Promise<LoyaltyResult<{ transactionId: string; balance: number }>> {
  return db.transaction(async (tx) => {
    const original = await tx.query.loyaltyTransaction.findFirst({
      where: eq(schema.loyaltyTransaction.id, input.transactionId),
    });
    if (!original) {
      return { ok: false, code: "transaction_not_found", message: "Transaction not found" };
    }
    if (original.reason === "ROLLBACK" || original.reason === "EXPIRY") {
      return {
        ok: false,
        code: "transaction_not_found",
        message: `Cannot rollback a ${original.reason} entry`,
      };
    }

    const [member] = (await tx
      .select()
      .from(schema.loyaltyMember)
      .where(eq(schema.loyaltyMember.id, original.memberId))
      .limit(1)
      .for("update")) as MemberRow[];
    if (!member) {
      return { ok: false, code: "member_not_found", message: "Loyalty member not found" };
    }

    const inverseDelta = -original.delta;
    const newBalance = member.balance + inverseDelta;
    const newLifetime =
      original.reason === "EARN" && original.delta > 0
        ? member.lifetimePoints - original.delta
        : member.lifetimePoints;

    const [txRow] = await tx
      .insert(schema.loyaltyTransaction)
      .values({
        memberId: member.id,
        delta: inverseDelta,
        balanceAfter: newBalance,
        reason: "ROLLBACK",
        note: input.note ?? `rollback ${original.id}`,
      })
      .returning({ id: schema.loyaltyTransaction.id });
    if (!txRow) throw new Error("loyalty rollback insert failed");

    await tx
      .update(schema.loyaltyMember)
      .set({
        balance: newBalance,
        lifetimePoints: newLifetime,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyMember.id, member.id));

    return { ok: true, data: { transactionId: txRow.id, balance: newBalance } };
  });
}

/**
 * Daily expiration sweep. For each EARN row with expires_at < now and
 * expired_at IS NULL, write an EXPIRY ledger row that cancels the
 * remaining (un-spent) portion of that earn. Simple model: expire the
 * full original delta; balance can go negative if the member already
 * spent expired points (acceptable; ADJUSTMENT can correct manually).
 */
export async function expirePoints(db: Db, now: Date = new Date()): Promise<{ expired: number }> {
  const candidates = await db
    .select()
    .from(schema.loyaltyTransaction)
    .where(
      and(
        lt(schema.loyaltyTransaction.expiresAt, now),
        isNull(schema.loyaltyTransaction.expiredAt),
        gt(schema.loyaltyTransaction.delta, 0),
        eq(schema.loyaltyTransaction.reason, "EARN"),
      ),
    )
    .orderBy(asc(schema.loyaltyTransaction.expiresAt))
    .limit(1000);

  let expired = 0;
  for (const row of candidates) {
    await db.transaction(async (tx) => {
      const [member] = (await tx
        .select()
        .from(schema.loyaltyMember)
        .where(eq(schema.loyaltyMember.id, row.memberId))
        .limit(1)
        .for("update")) as MemberRow[];
      if (!member) return;

      const newBalance = member.balance - row.delta;
      await tx.insert(schema.loyaltyTransaction).values({
        memberId: member.id,
        delta: -row.delta,
        balanceAfter: newBalance,
        reason: "EXPIRY",
        note: `expired ${row.id}`,
      });
      await tx
        .update(schema.loyaltyTransaction)
        .set({ expiredAt: now })
        .where(eq(schema.loyaltyTransaction.id, row.id));
      await tx
        .update(schema.loyaltyMember)
        .set({ balance: newBalance, updatedAt: now })
        .where(eq(schema.loyaltyMember.id, member.id));
    });
    expired++;
  }
  log.info({ expired }, "loyalty points expired");
  return { expired };
}

export async function recomputeBalance(db: Db, memberId: string): Promise<number> {
  const result = await db
    .select({ sum: sql<number>`coalesce(sum(${schema.loyaltyTransaction.delta}), 0)::int` })
    .from(schema.loyaltyTransaction)
    .where(eq(schema.loyaltyTransaction.memberId, memberId));
  const sum = result[0]?.sum ?? 0;
  await db
    .update(schema.loyaltyMember)
    .set({ balance: sum, updatedAt: new Date() })
    .where(eq(schema.loyaltyMember.id, memberId));
  return sum;
}

export async function listHistory(db: Db, memberId: string, limit = 100) {
  return db.query.loyaltyTransaction.findMany({
    where: eq(schema.loyaltyTransaction.memberId, memberId),
    orderBy: desc(schema.loyaltyTransaction.createdAt),
    limit,
  });
}
