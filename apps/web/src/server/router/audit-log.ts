import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import { decodeCursor, encodeCursor } from "./helpers";

const os = implement(contract).$context<RequestContext>();

function toAuditOutput(row: typeof schema.auditLog.$inferSelect) {
  return {
    id: row.id,
    actor: row.actor,
    actorId: row.actorId,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}

const list = os.auditLog.list.use(requireSession).handler(async ({ context, input }) => {
  if (context.user.role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "Admin role required" });
  }
  const filters: (SQL | undefined)[] = [];
  if (input.actor) filters.push(eq(schema.auditLog.actor, input.actor));
  if (input.entity) filters.push(eq(schema.auditLog.entity, input.entity));
  if (input.action) filters.push(eq(schema.auditLog.action, input.action));
  if (input.entityId) filters.push(eq(schema.auditLog.entityId, input.entityId));
  const cursor = decodeCursor(input.cursor);
  if (cursor) {
    filters.push(
      sql`(${schema.auditLog.createdAt}, ${schema.auditLog.id}) < (${cursor.createdAt}, ${cursor.id})`,
    );
  }
  const rows = await db()
    .select()
    .from(schema.auditLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.auditLog.createdAt), desc(schema.auditLog.id))
    .limit(input.limit + 1);
  const hasMore = rows.length > input.limit;
  const data = rows.slice(0, input.limit);
  const last = data[data.length - 1];
  return {
    data: data.map(toAuditOutput),
    ...(hasMore && last
      ? { next: encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) }
      : {}),
  };
});

export const auditLogRouter = { list };
