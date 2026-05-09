import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
  toOrder,
  type OrderRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

const list = os.orders.list.use(requireSession).handler(({ input }) => {
  const filters = [];
  if (input.customerId) filters.push(eq(schema.order.customerId, input.customerId));
  if (input.status) filters.push(eq(schema.order.status, input.status));
  if (input.search) {
    const term = `%${input.search.trim()}%`;
    const matcher = or(ilike(schema.order.externalId, term));
    if (matcher) filters.push(matcher);
  }
  return paginatedSoftDeleteList<OrderRow, ReturnType<typeof toOrder>>({
    table: schema.order,
    limit: input.limit,
    cursor: decodeCursor(input.cursor),
    filters,
    toOutput: toOrder,
  });
});

const get = os.orders.get.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.order.findFirst({
    where: and(eq(schema.order.id, input.id), isNull(schema.order.deletedAt)),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
  return toOrder(row);
});

const create = os.orders.create.use(requireSession).handler(async ({ input }) => {
  const [row] = await db()
    .insert(schema.order)
    .values({
      externalId: input.externalId ?? null,
      customerId: input.customerId ?? null,
      items: input.items,
      amount: input.amount,
      discountAmount: input.discountAmount ?? 0,
      currency: input.currency,
      status: input.status ?? "CREATED",
      metadata: input.metadata ?? {},
    })
    .returning();
  if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
  return toOrder(row);
});

const update = os.orders.update.use(requireSession).handler(async ({ input }) => {
  const patch: Partial<typeof schema.order.$inferInsert> = { updatedAt: new Date() };
  if (input.patch.status !== undefined) patch.status = input.patch.status;
  if (input.patch.discountAmount !== undefined) patch.discountAmount = input.patch.discountAmount;
  if (input.patch.metadata !== undefined) patch.metadata = input.patch.metadata;
  const [row] = await db()
    .update(schema.order)
    .set(patch)
    .where(and(eq(schema.order.id, input.id), isNull(schema.order.deletedAt)))
    .returning();
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
  return toOrder(row);
});

async function setOrderStatus(id: string, status: "CANCELED" | "FULFILLED") {
  const [row] = await db()
    .update(schema.order)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schema.order.id, id), isNull(schema.order.deletedAt)))
    .returning();
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
  return toOrder(row);
}

const cancel = os.orders.cancel
  .use(requireSession)
  .handler(({ input }) => setOrderStatus(input.id, "CANCELED"));

const fulfill = os.orders.fulfill
  .use(requireSession)
  .handler(({ input }) => setOrderStatus(input.id, "FULFILLED"));

const remove = os.orders.delete.use(requireSession).handler(async ({ input }) => {
  await softDeleteById(schema.order, input.id, "Order not found");
  return { ok: true as const };
});

const redemptionsList = os.orders.redemptions
  .use(requireSession)
  .handler(async ({ input }) => {
    const rows = await db()
      .select({
        id: schema.redemption.id,
        voucherCode: schema.voucher.code,
        voucherId: schema.redemption.voucherId,
        customerId: schema.redemption.customerId,
        result: schema.redemption.result,
        failureReason: schema.redemption.failureReason,
        amount: schema.redemption.amount,
        createdAt: schema.redemption.createdAt,
      })
      .from(schema.redemption)
      .innerJoin(schema.voucher, eq(schema.voucher.id, schema.redemption.voucherId))
      .where(eq(schema.redemption.orderId, input.id))
      .orderBy(schema.redemption.createdAt);

    return {
      data: rows.map((r) => ({
        id: r.id,
        voucherCode: r.voucherCode,
        voucherId: r.voucherId,
        customerId: r.customerId,
        result: r.result,
        failureReason: r.failureReason,
        amount: r.amount,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

export const ordersRouter = {
  list,
  get,
  create,
  update,
  cancel,
  fulfill,
  delete: remove,
  redemptions: redemptionsList,
};
