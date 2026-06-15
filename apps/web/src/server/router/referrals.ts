import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { convert as convertReferral, issueCode } from "@offerkit/core/referrals";
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
type ReferralCodeRow = typeof schema.referralCode.$inferSelect;
type ReferralConversionRow = typeof schema.referralConversion.$inferSelect;
type ReferralProgramConversionRow = ReferralConversionRow & {
  code: string;
  referrerCustomerId: string;
};

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

function toReferralCode(row: ReferralCodeRow) {
  return {
    id: row.id,
    programId: row.programId,
    referrerCustomerId: row.referrerCustomerId,
    code: row.code,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReferralConversion(row: ReferralConversionRow) {
  return {
    id: row.id,
    codeId: row.codeId,
    refereeCustomerId: row.refereeCustomerId,
    status: row.status,
    convertedAt: row.convertedAt.toISOString(),
    conversionEventId: row.conversionEventId,
    referrerOutcome: row.referrerOutcome,
    refereeOutcome: row.refereeOutcome,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReferralProgramConversion(row: ReferralProgramConversionRow) {
  return {
    ...toReferralConversion(row),
    code: row.code,
    referrerCustomerId: row.referrerCustomerId,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
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
        eq(schema.referralProgram.id, input.params.id),
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

    const existing = await db().query.referralProgram.findFirst({
      where: and(
        eq(schema.referralProgram.campaignId, input.campaignId),
        isNull(schema.referralProgram.deletedAt),
      ),
    });
    if (existing) {
      throw new ORPCError("CONFLICT", {
        message: "Campaign already has an active referral program",
      });
    }

    let row: ProgramRow | undefined;
    try {
      [row] = await db()
        .insert(schema.referralProgram)
        .values({
          campaignId: input.campaignId,
          referrerReward: input.referrerReward,
          refereeReward: input.refereeReward,
          codeLength: input.codeLength ?? 8,
          metadata: input.metadata ?? {},
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ORPCError("CONFLICT", {
          message: "Campaign already has an active referral program",
        });
      }
      throw err;
    }
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toProgram(row);
  });

const programUpdate = os.referrals.programs.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.referralProgram.$inferInsert> = { updatedAt: new Date() };
    const { patch: inputPatch } = input.body;
    if (inputPatch.referrerReward !== undefined) patch.referrerReward = inputPatch.referrerReward;
    if (inputPatch.refereeReward !== undefined) patch.refereeReward = inputPatch.refereeReward;
    if (inputPatch.codeLength !== undefined) patch.codeLength = inputPatch.codeLength;
    if (inputPatch.metadata !== undefined) patch.metadata = inputPatch.metadata;
    const [row] = await db()
      .update(schema.referralProgram)
      .set(patch)
      .where(
        and(
          eq(schema.referralProgram.id, input.params.id),
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
    await softDeleteById(schema.referralProgram, input.params.id, "Referral program not found");
    return { ok: true as const };
  });

const listCodes = os.referrals.listCodes
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.query.limit;
    const cursor = decodeCursor(input.query.cursor);
    const filters = [eq(schema.referralCode.programId, input.params.programId)];
    if (cursor) {
      filters.push(
        sql`(${schema.referralCode.createdAt}, ${schema.referralCode.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }
    const rows = (await db()
      .select()
      .from(schema.referralCode)
      .where(and(...filters))
      .orderBy(desc(schema.referralCode.createdAt), desc(schema.referralCode.id))
      .limit(limit + 1)) as ReferralCodeRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toReferralCode),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const listConversions = os.referrals.listConversions
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.query.limit;
    const cursor = decodeCursor(input.query.cursor);
    const filters = [eq(schema.referralConversion.codeId, input.params.codeId)];
    if (cursor) {
      filters.push(
        sql`(${schema.referralConversion.createdAt}, ${schema.referralConversion.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }
    const rows = (await db()
      .select()
      .from(schema.referralConversion)
      .where(and(...filters))
      .orderBy(desc(schema.referralConversion.createdAt), desc(schema.referralConversion.id))
      .limit(limit + 1)) as ReferralConversionRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toReferralConversion),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const listProgramConversions = os.referrals.listProgramConversions
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.query.limit;
    const cursor = decodeCursor(input.query.cursor);
    const filters = [eq(schema.referralCode.programId, input.params.programId)];
    if (cursor) {
      filters.push(
        sql`(${schema.referralConversion.createdAt}, ${schema.referralConversion.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }
    const rows = (await db()
      .select({
        id: schema.referralConversion.id,
        codeId: schema.referralConversion.codeId,
        refereeCustomerId: schema.referralConversion.refereeCustomerId,
        status: schema.referralConversion.status,
        convertedAt: schema.referralConversion.convertedAt,
        conversionEventId: schema.referralConversion.conversionEventId,
        referrerOutcome: schema.referralConversion.referrerOutcome,
        refereeOutcome: schema.referralConversion.refereeOutcome,
        createdAt: schema.referralConversion.createdAt,
        updatedAt: schema.referralConversion.updatedAt,
        code: schema.referralCode.code,
        referrerCustomerId: schema.referralCode.referrerCustomerId,
      })
      .from(schema.referralConversion)
      .innerJoin(schema.referralCode, eq(schema.referralConversion.codeId, schema.referralCode.id))
      .where(and(...filters))
      .orderBy(desc(schema.referralConversion.createdAt), desc(schema.referralConversion.id))
      .limit(limit + 1)) as ReferralProgramConversionRow[];
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toReferralProgramConversion),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const getByCode = os.referrals.getByCode.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.referralCode.findFirst({
    where: eq(schema.referralCode.code, input.params.code),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Referral not found" });
  return toReferralCode(row);
});

const issue = os.referrals.issue.use(requireSession).handler(async ({ input }) => {
  const result = await issueCode(db(), input);
  if (!result.ok) {
    return { ok: false, errorCode: result.code, message: result.message };
  }
  return { ok: true, codeId: result.codeId, code: result.code };
});

const convert = os.referrals.convert.use(requireSession).handler(async ({ input }) => {
  const result = await convertReferral(db(), input);
  if (!result.ok) {
    return { ok: false, errorCode: result.code, message: result.message };
  }
  return {
    ok: true,
    conversionId: result.conversionId,
    codeId: result.codeId,
    code: result.code,
    referrerCustomerId: result.referrerCustomerId,
    refereeCustomerId: result.refereeCustomerId,
    referrerReward: result.referrerReward,
    refereeReward: result.refereeReward,
    idempotent: result.idempotent,
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
  listCodes,
  listConversions,
  listProgramConversions,
  getByCode,
  issue,
  convert,
};
