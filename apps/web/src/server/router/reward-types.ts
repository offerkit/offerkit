import { createHash } from "node:crypto";
import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
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
    const search = input.search?.trim();
    const page = await paginatedSoftDeleteList<RewardTypeRow, RewardTypeRow>({
      table: schema.rewardType,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters: search ? [ilike(schema.rewardType.name, `%${search}%`)] : [],
      // Defer the row-to-output mapping; reward types need their active
      // revision joined in afterwards as a single batched lookup.
      toOutput: (row) => row,
    });
    const revisionIds = page.data
      .map((r) => r.activeRevisionId)
      .filter((v): v is string => v !== null);
    const revisions = revisionIds.length
      ? await db().query.rewardTypeRevision.findMany({
          where: (t, { inArray }) => inArray(t.id, revisionIds),
        })
      : [];
    const byId = new Map(revisions.map((r) => [r.id, r]));
    return {
      data: page.data.map((row) =>
        toRewardType(row, row.activeRevisionId ? byId.get(row.activeRevisionId) : undefined),
      ),
      next: page.next,
    };
  });

const get = os.rewardTypes.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.rewardType.findFirst({
      where: and(eq(schema.rewardType.id, input.params.id), isNull(schema.rewardType.deletedAt)),
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
          eq(schema.rewardType.id, input.params.id),
          isNull(schema.rewardType.deletedAt),
        ),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Reward type not found" });

      const patch: Partial<typeof schema.rewardType.$inferInsert> = { updatedAt: new Date() };
      const { patch: inputPatch } = input.body;
      if (inputPatch.name !== undefined) patch.name = inputPatch.name;
      if (inputPatch.description !== undefined)
        patch.description = inputPatch.description ?? null;

      let revision: RewardTypeRevisionRow | undefined;
      if (inputPatch.payloadSchema !== undefined) {
        const checksum = checksumSchema(inputPatch.payloadSchema);
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
              payloadSchema: inputPatch.payloadSchema,
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
    await softDeleteById(schema.rewardType, input.params.id, "Reward type not found");
    return { ok: true as const };
  });

export const rewardTypesRouter = { list, get, create, update, delete: remove };
