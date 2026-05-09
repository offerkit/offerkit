import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { generateReferralCode } from "../codes/index.ts";
import { logger } from "../observability/index.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const log = logger.child({ component: "referrals" });

export type ReferralFailureCode =
  | "program_not_found"
  | "referrer_not_found"
  | "referral_not_found"
  | "referral_already_converted"
  | "self_referral"
  | "missing_loyalty_member"
  | "validation_error";

export type ReferralResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: ReferralFailureCode; message: string };

type ReferralProgramRow = typeof schema.referralProgram.$inferSelect;
type ReferralRow = typeof schema.referral.$inferSelect;

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

export async function issueCode(
  db: Db,
  input: IssueInput,
): Promise<ReferralResult<{ referralId: string; code: string }>> {
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

  const existing = await db.query.referral.findFirst({
    where: and(
      eq(schema.referral.programId, program.id),
      eq(schema.referral.referrerCustomerId, customer.id),
    ),
  });
  if (existing) {
    return { ok: true, referralId: existing.id, code: existing.code };
  }

  const handle = handleFor(input.prefix, customer.name, customer.id);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode(handle, { length: program.codeLength });
    try {
      const [row] = await db
        .insert(schema.referral)
        .values({
          programId: program.id,
          referrerCustomerId: customer.id,
          code,
        })
        .returning({ id: schema.referral.id });
      if (!row) throw new Error("referral insert failed");
      return { ok: true, referralId: row.id, code };
    } catch (err) {
      // Unique violation on code → retry with a fresh suffix.
      const cause = err as { code?: string };
      if (cause.code !== "23505" || attempt === 5) throw err;
    }
  }
  return { ok: false, code: "validation_error", message: "Could not allocate a unique code" };
}

export interface ConvertInput {
  code: string;
  refereeCustomerId: string;
  /** Optional dedupe key for the conversion event (e.g. order id). */
  conversionEventId?: string;
}

export interface ConvertOutcome {
  referralId: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  referrerReward: ReferralIssued;
  refereeReward: ReferralIssued;
}

export interface ReferralIssued {
  kind: "discount" | "gift_card" | "loyalty_points" | "custom";
  voucherCode?: string;
  loyaltyTransactionId?: string;
  payload?: Record<string, unknown>;
}

export async function convert(
  db: Db,
  input: ConvertInput,
): Promise<ReferralResult<ConvertOutcome>> {
  return db.transaction(async (tx) => {
    const [r] = (await tx
      .select()
      .from(schema.referral)
      .where(eq(schema.referral.code, input.code))
      .limit(1)
      .for("update")) as ReferralRow[];
    if (!r) {
      return { ok: false, code: "referral_not_found", message: "Referral code not found" };
    }
    if (r.referrerCustomerId === input.refereeCustomerId) {
      return { ok: false, code: "self_referral", message: "Referrer cannot also be the referee" };
    }
    if (r.status === "converted") {
      // Re-conversion is rejected: the referee already received their
      // reward, and replaying might hand back codes for soft-deleted
      // vouchers. Look up GET /referrals/{code} for the original outcome.
      return {
        ok: false,
        code: "referral_already_converted",
        message: "Referral has already been converted",
      };
    }

    const program = await tx.query.referralProgram.findFirst({
      where: and(
        eq(schema.referralProgram.id, r.programId),
        isNull(schema.referralProgram.deletedAt),
      ),
    });
    if (!program) {
      return { ok: false, code: "program_not_found", message: "Referral program not found" };
    }

    const referrer = await issueReward(tx, program, r.referrerCustomerId, "referrer");
    if (!referrer.ok) {
      return { ok: false, code: referrer.code, message: referrer.message };
    }
    const referee = await issueReward(tx, program, input.refereeCustomerId, "referee");
    if (!referee.ok) {
      return { ok: false, code: referee.code, message: referee.message };
    }

    await tx
      .update(schema.referral)
      .set({
        refereeCustomerId: input.refereeCustomerId,
        status: "converted",
        convertedAt: new Date(),
        conversionEventId: input.conversionEventId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.referral.id, r.id));

    log.info(
      { referralId: r.id, code: r.code },
      "referral converted",
    );

    return {
      ok: true,
      referralId: r.id,
      referrerCustomerId: r.referrerCustomerId,
      refereeCustomerId: input.refereeCustomerId,
      referrerReward: pickIssued(referrer),
      refereeReward: pickIssued(referee),
    };
  });
}

function pickIssued(r: { ok: true } & ReferralIssued): ReferralIssued {
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
): Promise<ReferralResult<ReferralIssued>> {
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
