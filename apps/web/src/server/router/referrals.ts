import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import { convert as convertReferral, issueCode } from "@open-voucherify/core/referrals";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  encodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

type ProgramRow = typeof schema.referralProgram.$inferSelect;
type ReferralRow = typeof schema.referral.$inferSelect;

function toProgram(row: ProgramRow) {
  return {
    id: row.id,
    campaignId: row.campaignId,
    referrerReward: row.referrerReward,
    refereeReward: row.refereeReward,
    codeLength: row.codeLength,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReferral(row: ReferralRow) {
  return {
    id: row.id,
    programId: row.programId,
    referrerCustomerId: row.referrerCustomerId,
    refereeCustomerId: row.refereeCustomerId,
    code: row.code,
    status: row.status,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    conversionEventId: row.conversionEventId,
    referrerRedemptionId: row.referrerRedemptionId,
    refereeRedemptionId: row.refereeRedemptionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const programsList = os.referrals.programs.list
  .use(requireSession)
  .handler(({ input }) =>
    paginatedSoftDeleteList<ProgramRow, ReturnType<typeof toProgram>>({
      table: schema.referralProgram,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      toOutput: toProgram,
    }),
  );

const programGet = os.referrals.programs.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.referralProgram.findFirst({
      where: and(
        eq(schema.referralProgram.id, input.id),
        isNull(schema.referralProgram.deletedAt),
      ),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Referral program not found" });
    return toProgram(row);
  });

const programCreate = os.referrals.programs.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const campaign = await db().query.campaign.findFirst({
      where: and(
        eq(schema.campaign.id, input.campaignId),
        isNull(schema.campaign.deletedAt),
      ),
    });
    if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    if (campaign.type !== "REFERRAL_PROGRAM") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Campaign type must be REFERRAL_PROGRAM",
      });
    }
    const [row] = await db()
      .insert(schema.referralProgram)
      .values({
        campaignId: input.campaignId,
        referrerReward: input.referrerReward,
        refereeReward: input.refereeReward,
        codeLength: input.codeLength ?? 8,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toProgram(row);
  });

const programUpdate = os.referrals.programs.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.referralProgram.$inferInsert> = { updatedAt: new Date() };
    if (input.patch.referrerReward !== undefined) patch.referrerReward = input.patch.referrerReward;
    if (input.patch.refereeReward !== undefined) patch.refereeReward = input.patch.refereeReward;
    if (input.patch.codeLength !== undefined) patch.codeLength = input.patch.codeLength;
    if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;
    const [row] = await db()
      .update(schema.referralProgram)
      .set(patch)
      .where(
        and(
          eq(schema.referralProgram.id, input.id),
          isNull(schema.referralProgram.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Referral program not found" });
    return toProgram(row);
  });

const programDelete = os.referrals.programs.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    await softDeleteById(schema.referralProgram, input.id, "Referral program not found");
    return { ok: true as const };
  });

const listReferrals = os.referrals.listReferrals
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const filters = [eq(schema.referral.programId, input.programId)];
    if (cursor) {
      filters.push(
        sql`(${schema.referral.createdAt}, ${schema.referral.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }
    const rows = (await db()
      .select()
      .from(schema.referral)
      .where(and(...filters))
      .orderBy(desc(schema.referral.createdAt), desc(schema.referral.id))
      .limit(limit + 1)) as ReferralRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toReferral),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const getByCode = os.referrals.getByCode.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.referral.findFirst({
    where: eq(schema.referral.code, input.code),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Referral not found" });
  return toReferral(row);
});

const issue = os.referrals.issue.use(requireSession).handler(async ({ input }) => {
  const result = await issueCode(db(), input);
  if (!result.ok) {
    return { ok: false, errorCode: result.code, message: result.message };
  }
  return { ok: true, referralId: result.referralId, code: result.code };
});

const convert = os.referrals.convert.use(requireSession).handler(async ({ input }) => {
  const result = await convertReferral(db(), input);
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return {
    ok: true,
    referralId: result.referralId,
    referrerCustomerId: result.referrerCustomerId,
    refereeCustomerId: result.refereeCustomerId,
    referrerReward: result.referrerReward,
    refereeReward: result.refereeReward,
  };
});

export const referralsRouter = {
  programs: {
    list: programsList,
    get: programGet,
    create: programCreate,
    update: programUpdate,
    delete: programDelete,
  },
  listReferrals,
  getByCode,
  issue,
  convert,
};
