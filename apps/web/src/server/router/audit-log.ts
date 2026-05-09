import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";

const os = implement(contract).$context<RequestContext>();

interface AuditCursor {
  createdAt: string;
  id: string;
}

function encode(c: AuditCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decode(raw: string | undefined): AuditCursor | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString()) as AuditCursor;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") return parsed;
  } catch {
    // ignore
  }
  return undefined;
}

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
  const cursor = decode(input.cursor);
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
      ? { next: encode({ createdAt: last.createdAt.toISOString(), id: last.id }) }
      : {}),
  };
});

export const auditLogRouter = { list };
