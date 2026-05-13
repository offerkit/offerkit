import { and, eq, sql, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import type { ReferralOutcome } from "@offerkit/db/schema";
import { generateReferralCode } from "../codes/index.ts";
import { logger } from "../observability/index.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const log = logger.child({ component: "referrals" });

export type ReferralFailureCode =
  | "program_not_found"
  | "referrer_not_found"
  | "referral_not_found"
  | "referee_already_converted"
  | "self_referral"
  | "missing_loyalty_member"
  | "validation_error";

export type ReferralResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: ReferralFailureCode; message: string };

type ReferralProgramRow = typeof schema.referralProgram.$inferSelect;

function handleFor(prefix: string | undefined, customerName: string | null, customerId: string): string {
  if (prefix?.trim()) return prefix.toUpperCase().slice(0, 12);
  if (customerName) {
    const cleaned = customerName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);
    if (cleaned) return cleaned;
  }
  return customerId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export interface IssueInput {
  programId: string;
  referrerCustomerId: string;
  /** Optional override of the prefix; otherwise derived from the customer's name. */
  prefix?: string;
}

/**
 * Idempotently fetch-or-create the stable referral code for a (program,
 * referrerCustomerId) pair. Calling repeatedly returns the same code.
 */
export async function issueCode(
  db: Db,
  input: IssueInput,
): Promise<ReferralResult<{ codeId: string; code: string }>> {
  const program = await db.query.referralProgram.findFirst({
    where: and(
      eq(schema.referralProgram.id, input.programId),
      isNull(schema.referralProgram.deletedAt),
    ),
  });
  if (!program) {
    return { ok: false, code: "program_not_found", message: "Referral program not found" };
  }

  const customer = await db.query.customer.findFirst({
    where: and(eq(schema.customer.id, input.referrerCustomerId), isNull(schema.customer.deletedAt)),
  });
  if (!customer) {
    return { ok: false, code: "referrer_not_found", message: "Referrer customer not found" };
  }

  const existing = await db.query.referralCode.findFirst({
    where: and(
      eq(schema.referralCode.programId, program.id),
      eq(schema.referralCode.referrerCustomerId, customer.id),
    ),
  });
  if (existing) {
    return { ok: true, codeId: existing.id, code: existing.code };
  }

  const handle = handleFor(input.prefix, customer.name, customer.id);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode(handle, { length: program.codeLength });
    try {
      const [row] = await db
        .insert(schema.referralCode)
        .values({
          programId: program.id,
          referrerCustomerId: customer.id,
          code,
        })
        .returning({ id: schema.referralCode.id });
      if (!row) throw new Error("referral code insert failed");
      return { ok: true, codeId: row.id, code };
    } catch (err) {
      // Two unique violations to handle:
      //  1. code collision (random suffix) — retry with new suffix
      //  2. (program, referrer) collision — another concurrent caller won the
      //     race and inserted the row first. Re-read and return that row.
      const cause = err as { code?: string; constraint?: string; constraint_name?: string };
      if (cause.code === "23505") {
        const constraint = cause.constraint ?? cause.constraint_name ?? "";
        if (constraint.includes("program_referrer")) {
          const winner = await db.query.referralCode.findFirst({
            where: and(
              eq(schema.referralCode.programId, program.id),
              eq(schema.referralCode.referrerCustomerId, customer.id),
            ),
          });
          if (winner) return { ok: true, codeId: winner.id, code: winner.code };
        }
        // Otherwise it's a code collision; try the next suffix.
        if (attempt < 5) continue;
      }
      throw err;
    }
  }
  return { ok: false, code: "validation_error", message: "Could not allocate a unique code" };
}

export interface ConvertInput {
  code: string;
  refereeCustomerId: string;
  /**
   * Optional dedupe key for the conversion event (e.g. order id). When set,
   * a second call with the same key returns the prior outcome idempotently
   * instead of erroring or duplicating.
   */
  conversionEventId?: string;
}

export interface ConvertOutcome {
  conversionId: string;
  code: string;
  codeId: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  referrerReward: ReferralOutcome;
  refereeReward: ReferralOutcome;
  /** True when this call replayed an existing conversion by event-id dedupe. */
  idempotent: boolean;
}

/**
 * Apply a referral code on behalf of a referee. Issues both sides' rewards
 * atomically and records a referralConversion row. Multiple referees can
 * convert the same code; the same referee can only convert it once.
 *
 * Idempotency:
 * - Same (codeId, refereeCustomerId) replay → returns referee_already_converted.
 * - Same (codeId, conversionEventId) replay → returns the prior outcome with
 *   idempotent=true.
 */
export async function convert(
  db: Db,
  input: ConvertInput,
): Promise<ReferralResult<ConvertOutcome>> {
  return db.transaction(async (tx) => {
    const codeRow = await tx.query.referralCode.findFirst({
      where: eq(schema.referralCode.code, input.code),
    });
    if (!codeRow) {
      return { ok: false, code: "referral_not_found", message: "Referral code not found" };
    }

    if (codeRow.referrerCustomerId === input.refereeCustomerId) {
      return { ok: false, code: "self_referral", message: "Referrer cannot also be the referee" };
    }

    // Idempotent replay by conversionEventId — return the prior conversion.
    if (input.conversionEventId) {
      const priorByEvent = await tx.query.referralConversion.findFirst({
        where: and(
          eq(schema.referralConversion.codeId, codeRow.id),
          eq(schema.referralConversion.conversionEventId, input.conversionEventId),
        ),
      });
      if (priorByEvent) {
        return {
          ok: true,
          conversionId: priorByEvent.id,
          code: codeRow.code,
          codeId: codeRow.id,
          referrerCustomerId: codeRow.referrerCustomerId,
          refereeCustomerId: priorByEvent.refereeCustomerId,
          referrerReward: priorByEvent.referrerOutcome,
          refereeReward: priorByEvent.refereeOutcome,
          idempotent: true,
        };
      }
    }

    // Same referee replay → reject. We don't return the prior outcome here
    // because the caller is asking for a *new* conversion for the same person,
    // which is not allowed.
    const priorByReferee = await tx
      .select()
      .from(schema.referralConversion)
      .where(
        and(
          eq(schema.referralConversion.codeId, codeRow.id),
          eq(schema.referralConversion.refereeCustomerId, input.refereeCustomerId),
        ),
      )
      .limit(1)
      .for("update");
    if (priorByReferee[0]) {
      return {
        ok: false,
        code: "referee_already_converted",
        message: "This referee has already converted this referral code",
      };
    }

    const program = await tx.query.referralProgram.findFirst({
      where: and(
        eq(schema.referralProgram.id, codeRow.programId),
        isNull(schema.referralProgram.deletedAt),
      ),
    });
    if (!program) {
      return { ok: false, code: "program_not_found", message: "Referral program not found" };
    }

    const referrer = await issueReward(tx, program, codeRow.referrerCustomerId, "referrer");
    if (!referrer.ok) {
      return { ok: false, code: referrer.code, message: referrer.message };
    }
    const referee = await issueReward(tx, program, input.refereeCustomerId, "referee");
    if (!referee.ok) {
      return { ok: false, code: referee.code, message: referee.message };
    }

    const referrerOutcome = pickIssued(referrer);
    const refereeOutcome = pickIssued(referee);

    let insertedId: string;
    try {
      const [row] = await tx
        .insert(schema.referralConversion)
        .values({
          codeId: codeRow.id,
          refereeCustomerId: input.refereeCustomerId,
          conversionEventId: input.conversionEventId ?? null,
          referrerOutcome,
          refereeOutcome,
        })
        .returning({ id: schema.referralConversion.id });
      if (!row) throw new Error("referral_conversion insert failed");
      insertedId = row.id;
    } catch (err) {
      // Race: another concurrent call won. Distinguish event-id vs referee dup.
      const cause = err as { code?: string; constraint?: string; constraint_name?: string };
      if (cause.code === "23505") {
        const constraint = cause.constraint ?? cause.constraint_name ?? "";
        if (constraint.includes("code_event") && input.conversionEventId) {
          const winner = await tx.query.referralConversion.findFirst({
            where: and(
              eq(schema.referralConversion.codeId, codeRow.id),
              eq(schema.referralConversion.conversionEventId, input.conversionEventId),
            ),
          });
          if (winner) {
            return {
              ok: true,
              conversionId: winner.id,
              code: codeRow.code,
              codeId: codeRow.id,
              referrerCustomerId: codeRow.referrerCustomerId,
              refereeCustomerId: winner.refereeCustomerId,
              referrerReward: winner.referrerOutcome,
              refereeReward: winner.refereeOutcome,
              idempotent: true,
            };
          }
        }
        return {
          ok: false,
          code: "referee_already_converted",
          message: "This referee has already converted this referral code",
        };
      }
      throw err;
    }

    log.info(
      { conversionId: insertedId, codeId: codeRow.id, code: codeRow.code },
      "referral converted",
    );

    return {
      ok: true,
      conversionId: insertedId,
      code: codeRow.code,
      codeId: codeRow.id,
      referrerCustomerId: codeRow.referrerCustomerId,
      refereeCustomerId: input.refereeCustomerId,
      referrerReward: referrerOutcome,
      refereeReward: refereeOutcome,
      idempotent: false,
    };
  });
}

interface IssueRewardOk {
  ok: true;
  kind: ReferralOutcome["kind"];
  voucherCode?: string;
  loyaltyTransactionId?: string;
  payload?: Record<string, unknown>;
}

type IssueRewardResult =
  | IssueRewardOk
  | { ok: false; code: ReferralFailureCode; message: string };

function pickIssued(r: IssueRewardOk): ReferralOutcome {
  return {
    kind: r.kind,
    voucherCode: r.voucherCode,
    loyaltyTransactionId: r.loyaltyTransactionId,
    payload: r.payload,
  };
}

async function issueReward(
  tx: Tx,
  program: ReferralProgramRow,
  customerId: string,
  side: "referrer" | "referee",
): Promise<IssueRewardResult> {
  const reward = side === "referrer" ? program.referrerReward : program.refereeReward;

  switch (reward.kind) {
    case "discount": {
      if (!reward.discount) {
        return {
          ok: false,
          code: "validation_error",
          message: `${side} reward kind=discount is missing its discount config`,
        };
      }
      const code = generateReferralCode("REF", { length: 10 });
      const [voucher] = await tx
        .insert(schema.voucher)
        .values({
          code,
          campaignId: program.campaignId,
          type: "DISCOUNT",
          discount: reward.discount,
          customerId,
          redemptionLimit: 1,
        })
        .returning({ id: schema.voucher.id, code: schema.voucher.code });
      if (!voucher) throw new Error("voucher insert failed");
      await tx
        .update(schema.campaign)
        .set({
          voucherCount: sql`${schema.campaign.voucherCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaign.id, program.campaignId));
      return { ok: true, kind: "discount", voucherCode: voucher.code };
    }
    case "gift_card": {
      if (reward.creditCents == null || reward.creditCents <= 0) {
        return {
          ok: false,
          code: "validation_error",
          message: `${side} reward kind=gift_card requires creditCents > 0`,
        };
      }
      const code = generateReferralCode("GIFT", { length: 10 });
      const [voucher] = await tx
        .insert(schema.voucher)
        .values({
          code,
          campaignId: program.campaignId,
          type: "GIFT_CARD",
          giftBalance: reward.creditCents,
          customerId,
        })
        .returning({ id: schema.voucher.id, code: schema.voucher.code });
      if (!voucher) throw new Error("voucher insert failed");
      await tx.insert(schema.giftCardTransaction).values({
        voucherId: voucher.id,
        delta: reward.creditCents,
        balanceAfter: reward.creditCents,
        reason: "CREDIT",
      });
      await tx
        .update(schema.campaign)
        .set({
          voucherCount: sql`${schema.campaign.voucherCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaign.id, program.campaignId));
      return { ok: true, kind: "gift_card", voucherCode: voucher.code };
    }
    case "loyalty_points": {
      if (!reward.loyaltyProgramId || reward.loyaltyPoints == null || reward.loyaltyPoints <= 0) {
        return {
          ok: false,
          code: "validation_error",
          message: `${side} reward kind=loyalty_points requires loyaltyProgramId and loyaltyPoints > 0`,
        };
      }
      const [member] = (await tx
        .select()
        .from(schema.loyaltyMember)
        .where(
          and(
            eq(schema.loyaltyMember.customerId, customerId),
            eq(schema.loyaltyMember.programId, reward.loyaltyProgramId),
          ),
        )
        .limit(1)
        .for("update")) as (typeof schema.loyaltyMember.$inferSelect)[];
      if (!member) {
        return {
          ok: false,
          code: "missing_loyalty_member",
          message: `Customer ${customerId} is not enrolled in the loyalty program`,
        };
      }
      const newBalance = member.balance + reward.loyaltyPoints;
      const [txRow] = await tx
        .insert(schema.loyaltyTransaction)
        .values({
          memberId: member.id,
          delta: reward.loyaltyPoints,
          balanceAfter: newBalance,
          reason: "ADJUSTMENT",
          note: `referral ${side}`,
        })
        .returning({ id: schema.loyaltyTransaction.id });
      if (!txRow) throw new Error("loyalty transaction insert failed");
      await tx
        .update(schema.loyaltyMember)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(schema.loyaltyMember.id, member.id));
      return { ok: true, kind: "loyalty_points", loyaltyTransactionId: txRow.id };
    }
    case "custom": {
      if (!reward.typeKey) {
        return {
          ok: false,
          code: "validation_error",
          message: `${side} reward kind=custom requires a typeKey`,
        };
      }
      return { ok: true, kind: "custom", payload: reward.payload ?? {} };
    }
  }
}
