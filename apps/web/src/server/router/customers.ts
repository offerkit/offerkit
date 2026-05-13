import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { emitEvent } from "@offerkit/core/events";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
  toCustomer,
  type CustomerRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

const list = os.customers.list
  .use(requireSession)
  .handler(({ input }) => {
    const search = input.search?.trim();
    const filters = [];
    if (search) {
      const matches = or(
        ilike(schema.customer.email, `%${search}%`),
        ilike(schema.customer.name, `%${search}%`),
      );
      if (matches) filters.push(matches);
    }
    return paginatedSoftDeleteList<CustomerRow, ReturnType<typeof toCustomer>>({
      table: schema.customer,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters,
      toOutput: toCustomer,
    });
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

const getByExternalId = os.customers.getByExternalId
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.customer.findFirst({
      where: and(
        eq(schema.customer.externalId, input.externalId),
        isNull(schema.customer.deletedAt),
      ),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
    return toCustomer(row);
  });

const create = os.customers.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().transaction(async (tx) => {
      const [r] = await tx
        .insert(schema.customer)
        .values({
          email: input.email ?? null,
          name: input.name ?? null,
          phone: input.phone ?? null,
          externalId: input.externalId ?? null,
          address: input.address ?? null,
          metadata: input.metadata ?? {},
        })
        .returning();
      if (!r) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
      await emitEvent(tx, {
        type: "customer.created",
        entityId: r.id,
        payload: { customerId: r.id, email: r.email, name: r.name, externalId: r.externalId },
      });
      return r;
    });
    return toCustomer(row);
  });

// Idempotent on externalId. Single-tx find-or-create. On race (two callers
// upserting the same externalId at once), the unique index wins; we catch
// the 23505 and re-read.
const upsert = os.customers.upsert
  .use(requireSession)
  .handler(async ({ input }) => {
    const result = await db().transaction(async (tx) => {
      const existing = await tx.query.customer.findFirst({
        where: and(
          eq(schema.customer.externalId, input.externalId),
          isNull(schema.customer.deletedAt),
        ),
      });
      if (existing) {
        const patch: Partial<typeof schema.customer.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (input.email !== undefined) patch.email = input.email;
        if (input.name !== undefined) patch.name = input.name;
        if (input.phone !== undefined) patch.phone = input.phone;
        if (input.address !== undefined) patch.address = input.address;
        if (input.metadata !== undefined) patch.metadata = input.metadata;
        const [updated] = await tx
          .update(schema.customer)
          .set(patch)
          .where(eq(schema.customer.id, existing.id))
          .returning();
        if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });
        return { row: updated, created: false };
      }
      try {
        const [r] = await tx
          .insert(schema.customer)
          .values({
            externalId: input.externalId,
            email: input.email ?? null,
            name: input.name ?? null,
            phone: input.phone ?? null,
            address: input.address ?? null,
            metadata: input.metadata ?? {},
          })
          .returning();
        if (!r) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
        await emitEvent(tx, {
          type: "customer.created",
          entityId: r.id,
          payload: { customerId: r.id, email: r.email, name: r.name, externalId: r.externalId },
        });
        return { row: r, created: true };
      } catch (err) {
        const cause = err as { code?: string };
        if (cause.code === "23505") {
          // A concurrent caller won the race. Re-read and patch instead.
          const winner = await tx.query.customer.findFirst({
            where: and(
              eq(schema.customer.externalId, input.externalId),
              isNull(schema.customer.deletedAt),
            ),
          });
          if (winner) return { row: winner, created: false };
        }
        throw err;
      }
    });
    return { customer: toCustomer(result.row), created: result.created };
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
    if (input.patch.externalId !== undefined) patch.externalId = input.patch.externalId ?? null;
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
    await softDeleteById(schema.customer, input.id, "Customer not found");
    return { ok: true as const };
  });

export const customersRouter = {
  list,
  get,
  getByExternalId,
  create,
  upsert,
  update,
  delete: remove,
};
