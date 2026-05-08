import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import { evaluateRule, type Rule } from "@open-voucherify/core/rules";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  encodeCursor,
  toCustomer,
  toSegment,
  type CustomerRow,
  type SegmentRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

const list = os.segments.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const search = input.search?.trim();

    const filters = [isNull(schema.segment.deletedAt)];
    if (search) filters.push(ilike(schema.segment.name, `%${search}%`));
    if (cursor) {
      filters.push(
        sql`(${schema.segment.createdAt}, ${schema.segment.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }

    const rows = (await db()
      .select()
      .from(schema.segment)
      .where(and(...filters))
      .orderBy(desc(schema.segment.createdAt), desc(schema.segment.id))
      .limit(limit + 1)) as SegmentRow[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];

    return {
      data: data.map(toSegment),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const get = os.segments.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.segment.findFirst({
      where: and(eq(schema.segment.id, input.id), isNull(schema.segment.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Segment not found" });
    return toSegment(row);
  });

const create = os.segments.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.segment)
      .values({
        name: input.name,
        description: input.description ?? null,
        rule: input.rule,
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toSegment(row);
  });

const update = os.segments.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.segment.$inferInsert> = { updatedAt: new Date() };
    if (input.patch.name !== undefined) patch.name = input.patch.name;
    if (input.patch.description !== undefined) patch.description = input.patch.description ?? null;
    if (input.patch.rule !== undefined) patch.rule = input.patch.rule;

    const [row] = await db()
      .update(schema.segment)
      .set(patch)
      .where(and(eq(schema.segment.id, input.id), isNull(schema.segment.deletedAt)))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Segment not found" });
    return toSegment(row);
  });

const remove = os.segments.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.segment)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.segment.id, input.id), isNull(schema.segment.deletedAt)))
      .returning({ id: schema.segment.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Segment not found" });
    return { ok: true as const };
  });

const preview = os.segments.preview
  .use(requireSession)
  .handler(async ({ input }) => {
    // Phase 2 supports customer-attribute rules. Stream all non-deleted
    // customers through the rules engine and tally matches. At Voucherify
    // scale this becomes a recompute job, but Phase 2 traffic fits in memory.
    const customers = (await db()
      .select()
      .from(schema.customer)
      .where(isNull(schema.customer.deletedAt))
      .orderBy(desc(schema.customer.createdAt))
      .limit(10_000)) as CustomerRow[];

    let matchedCount = 0;
    const sample: ReturnType<typeof toCustomer>[] = [];
    const rule = input.rule as Rule;

    for (const c of customers) {
      const result = evaluateRule(rule, {
        now: new Date().toISOString(),
        metadata: {},
        customer: {
          id: c.id,
          email: c.email,
          name: c.name,
          phone: c.phone,
          address: c.address ? { ...c.address } : null,
          metadata: c.metadata,
          summary: c.summary,
          segments: [],
        },
      });
      if (result.passed) {
        matchedCount++;
        if (sample.length < input.sampleSize) sample.push(toCustomer(c));
      }
    }

    return { matchedCount, sample };
  });

export const segmentsRouter = { list, get, create, update, delete: remove, preview };
