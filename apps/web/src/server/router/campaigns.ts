import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import { decodeCursor, encodeCursor, toCampaign, type CampaignRow } from "./helpers";

const os = implement(contract).$context<RequestContext>();

function toDateOrNull(value: string | undefined | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

const list = os.campaigns.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const search = input.search?.trim();

    const filters = [isNull(schema.campaign.deletedAt)];
    if (search) filters.push(ilike(schema.campaign.name, `%${search}%`));
    if (cursor) {
      filters.push(
        sql`(${schema.campaign.createdAt}, ${schema.campaign.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }

    const rows = (await db()
      .select()
      .from(schema.campaign)
      .where(and(...filters))
      .orderBy(desc(schema.campaign.createdAt), desc(schema.campaign.id))
      .limit(limit + 1)) as CampaignRow[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];

    return {
      data: data.map(toCampaign),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const get = os.campaigns.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.campaign.findFirst({
      where: and(eq(schema.campaign.id, input.id), isNull(schema.campaign.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    return toCampaign(row);
  });

const create = os.campaigns.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.campaign)
      .values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        currency: input.currency,
        timezone: input.timezone ?? "UTC",
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        codeConfig: input.codeConfig ?? {},
        validationRuleId: input.validationRuleId ?? null,
        autoApply: input.autoApply ?? false,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toCampaign(row);
  });

const update = os.campaigns.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.campaign.$inferInsert> = { updatedAt: new Date() };
    if (input.patch.name !== undefined) patch.name = input.patch.name;
    if (input.patch.description !== undefined)
      patch.description = input.patch.description ?? null;
    if (input.patch.status !== undefined) patch.status = input.patch.status;
    if (input.patch.currency !== undefined) patch.currency = input.patch.currency;
    if (input.patch.timezone !== undefined) patch.timezone = input.patch.timezone;
    if (input.patch.startDate !== undefined) {
      const v = toDateOrNull(input.patch.startDate);
      if (v !== undefined) patch.startDate = v;
    }
    if (input.patch.endDate !== undefined) {
      const v = toDateOrNull(input.patch.endDate);
      if (v !== undefined) patch.endDate = v;
    }
    if (input.patch.codeConfig !== undefined) patch.codeConfig = input.patch.codeConfig;
    if (input.patch.validationRuleId !== undefined)
      patch.validationRuleId = input.patch.validationRuleId ?? null;
    if (input.patch.autoApply !== undefined) patch.autoApply = input.patch.autoApply;
    if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;

    const [row] = await db()
      .update(schema.campaign)
      .set(patch)
      .where(and(eq(schema.campaign.id, input.id), isNull(schema.campaign.deletedAt)))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    return toCampaign(row);
  });

const remove = os.campaigns.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.campaign)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.campaign.id, input.id), isNull(schema.campaign.deletedAt)))
      .returning({ id: schema.campaign.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Campaign not found" });
    return { ok: true as const };
  });

export const campaignsRouter = { list, get, create, update, delete: remove };
