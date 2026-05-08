import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import { decodeCursor, encodeCursor, toCustomer, type CustomerRow } from "./helpers";

const os = implement(contract).$context<RequestContext>();

const list = os.customers.list
  .use(requireSession)
  .handler(async ({ input }) => {
    const limit = input.limit;
    const cursor = decodeCursor(input.cursor);
    const search = input.search?.trim();

    const filters = [isNull(schema.customer.deletedAt)];
    if (search) {
      const matches = or(
        ilike(schema.customer.email, `%${search}%`),
        ilike(schema.customer.name, `%${search}%`),
      );
      if (matches) filters.push(matches);
    }
    if (cursor) {
      filters.push(
        sql`(${schema.customer.createdAt}, ${schema.customer.id}) < (${cursor.createdAt}, ${cursor.id})`,
      );
    }

    const rows = (await db()
      .select()
      .from(schema.customer)
      .where(and(...filters))
      .orderBy(desc(schema.customer.createdAt), desc(schema.customer.id))
      .limit(limit + 1)) as CustomerRow[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data[data.length - 1];

    return {
      data: data.map(toCustomer),
      next:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : undefined,
    };
  });

const get = os.customers.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.customer.findFirst({
      where: and(eq(schema.customer.id, input.id), isNull(schema.customer.deletedAt)),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
    return toCustomer(row);
  });

const create = os.customers.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.customer)
      .values({
        email: input.email ?? null,
        name: input.name ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        metadata: input.metadata ?? {},
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toCustomer(row);
  });

const update = os.customers.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.customer.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.patch.email !== undefined) patch.email = input.patch.email ?? null;
    if (input.patch.name !== undefined) patch.name = input.patch.name ?? null;
    if (input.patch.phone !== undefined) patch.phone = input.patch.phone ?? null;
    if (input.patch.address !== undefined) patch.address = input.patch.address ?? null;
    if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;

    const [row] = await db()
      .update(schema.customer)
      .set(patch)
      .where(and(eq(schema.customer.id, input.id), isNull(schema.customer.deletedAt)))
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
    return toCustomer(row);
  });

const remove = os.customers.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.customer)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.customer.id, input.id), isNull(schema.customer.deletedAt)))
      .returning({ id: schema.customer.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
    return { ok: true as const };
  });

export const customersRouter = { list, get, create, update, delete: remove };
