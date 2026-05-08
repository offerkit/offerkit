import { createHash } from "node:crypto";
import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  encodeCursor,
  toRewardType,
  type RewardTypeRow,
  type RewardTypeRevisionRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

function checksumSchema(payloadSchema: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payloadSchema)).digest("hex");
}

async function loadActiveRevision(
  rewardTypeId: string,
  activeRevisionId: string | null,
): Promise<RewardTypeRevisionRow | undefined> {
  if (!activeRevisionId) return undefined;
  return db().query.rewardTypeRevision.findFirst({
    where: and(
      eq(schema.rewardTypeRevision.id, activeRevisionId),
      eq(schema.rewardTypeRevision.rewardTypeId, rewardTypeId),
    ),
  });
}

const list = os.rewardTypes.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const search = input.search?.trim();

    const filters = [isNull(schema.rewardType.deletedAt)];
    if (search) filters.push(ilike(schema.rewardType.name, `%${search}%`));
    if (cursor) {
      filters.push(
        sql`(${schema.rewardType.createdAt}, ${schema.rewardType.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }

    const rows = (await db()
      .select()
      .from(schema.rewardType)
      .where(and(...filters))
      .orderBy(desc(schema.rewardType.createdAt), desc(schema.rewardType.id))
      .limit(limit + 1)) as RewardTypeRow[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];

    const revisionIds = data
      .map((r) => r.activeRevisionId)
      .filter((v): v is string => v !== null);
    const revisions = revisionIds.length
      ? await db().query.rewardTypeRevision.findMany({
          where: (t, { inArray }) => inArray(t.id, revisionIds),
        })
      : [];
    const byId = new Map(revisions.map((r) => [r.id, r]));

    return {
      data: data.map((row) =>
        toRewardType(row, row.activeRevisionId ? byId.get(row.activeRevisionId) : undefined),
      ),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const get = os.rewardTypes.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.rewardType.findFirst({
      where: and(eq(schema.rewardType.id, input.id), isNull(schema.rewardType.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Reward type not found" });
    const revision = await loadActiveRevision(row.id, row.activeRevisionId);
    return toRewardType(row, revision);
  });

const create = os.rewardTypes.create
  .use(requireSession)
  .handler(async ({ input }) => {
    return db().transaction(async (tx) => {
      const [rt] = await tx
        .insert(schema.rewardType)
        .values({
          key: input.key,
          name: input.name,
          description: input.description ?? null,
        })
        .returning();
      if (!rt) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });

      const [rev] = await tx
        .insert(schema.rewardTypeRevision)
        .values({
          rewardTypeId: rt.id,
          payloadSchema: input.payloadSchema,
          checksum: checksumSchema(input.payloadSchema),
        })
        .returning();
      if (!rev) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Revision insert failed" });

      const [updated] = await tx
        .update(schema.rewardType)
        .set({ activeRevisionId: rev.id, updatedAt: new Date() })
        .where(eq(schema.rewardType.id, rt.id))
        .returning();
      if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });

      return toRewardType(updated, rev);
    });
  });

const update = os.rewardTypes.update
  .use(requireSession)
  .handler(async ({ input }) => {
    return db().transaction(async (tx) => {
      const existing = await tx.query.rewardType.findFirst({
        where: and(
          eq(schema.rewardType.id, input.id),
          isNull(schema.rewardType.deletedAt),
        ),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Reward type not found" });

      const patch: Partial<typeof schema.rewardType.$inferInsert> = { updatedAt: new Date() };
      if (input.patch.name !== undefined) patch.name = input.patch.name;
      if (input.patch.description !== undefined)
        patch.description = input.patch.description ?? null;

      let revision: RewardTypeRevisionRow | undefined;
      if (input.patch.payloadSchema !== undefined) {
        const checksum = checksumSchema(input.patch.payloadSchema);
        const current = existing.activeRevisionId
          ? await tx.query.rewardTypeRevision.findFirst({
              where: eq(schema.rewardTypeRevision.id, existing.activeRevisionId),
            })
          : undefined;
        if (!current || current.checksum !== checksum) {
          const [rev] = await tx
            .insert(schema.rewardTypeRevision)
            .values({
              rewardTypeId: existing.id,
              payloadSchema: input.patch.payloadSchema,
              checksum,
            })
            .returning();
          if (!rev)
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Revision insert failed" });
          revision = rev;
          patch.activeRevisionId = rev.id;
        } else {
          revision = current;
        }
      }

      const [row] = await tx
        .update(schema.rewardType)
        .set(patch)
        .where(eq(schema.rewardType.id, existing.id))
        .returning();
      if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });

      const finalRevision =
        revision ?? (await loadActiveRevision(row.id, row.activeRevisionId));
      return toRewardType(row, finalRevision);
    });
  });

const remove = os.rewardTypes.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.rewardType)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.rewardType.id, input.id), isNull(schema.rewardType.deletedAt)))
      .returning({ id: schema.rewardType.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Reward type not found" });
    return { ok: true as const };
  });

export const rewardTypesRouter = { list, get, create, update, delete: remove };
