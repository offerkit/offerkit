import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgTable, PgColumn } from "drizzle-orm/pg-core";
import type { schema } from "@open-voucherify/db";
import { db } from "@/lib/db";

export type CustomerRow = typeof schema.customer.$inferSelect;
export type SegmentRow = typeof schema.segment.$inferSelect;
export type CampaignRow = typeof schema.campaign.$inferSelect;
export type VoucherRow = typeof schema.voucher.$inferSelect;
export type ValidationRuleRow = typeof schema.validationRule.$inferSelect;
export type RewardTypeRow = typeof schema.rewardType.$inferSelect;
export type RewardTypeRevisionRow = typeof schema.rewardTypeRevision.$inferSelect;

export interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Cursor;
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return parsed;
    }
  } catch {
    // fall through
  }
  return undefined;
}

export function toCustomer(row: CustomerRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    address: row.address,
    metadata: row.metadata,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSegment(row: SegmentRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rule: row.rule,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    currency: row.currency,
    timezone: row.timezone,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    codeConfig: row.codeConfig,
    validationRuleId: row.validationRuleId,
    autoApply: row.autoApply,
    voucherCount: row.voucherCount,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVoucher(row: VoucherRow) {
  return {
    id: row.id,
    code: row.code,
    campaignId: row.campaignId,
    type: row.type,
    discount: row.discount,
    customRewards: row.customRewards,
    giftBalance: row.giftBalance,
    redemptionLimit: row.redemptionLimit,
    redemptionCount: row.redemptionCount,
    priority: row.priority,
    exclusive: row.exclusive,
    active: row.active,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    customerId: row.customerId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toValidationRule(row: ValidationRuleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rule: row.rule,
    appliesTo: row.appliesTo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRewardType(row: RewardTypeRow, revision: RewardTypeRevisionRow | undefined) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    payloadSchema: revision?.payloadSchema ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Tables we paginate over share three columns (id, createdAt, deletedAt).
// Drizzle's typed builders don't infer well across generic table refs, so
// the helper accepts a small descriptor and casts internally; the public
// signatures stay typed via the toOutput mapper.
interface SoftDeleteTable {
  id: PgColumn;
  createdAt: PgColumn;
  deletedAt: PgColumn;
}

interface PaginatedListOpts<TRow, TOut> {
  table: AnyPgTable & SoftDeleteTable;
  limit: number;
  cursor: Cursor | undefined;
  /** Extra WHERE predicates (e.g. search, foreign-key scoping). */
  filters?: SQL[];
  toOutput: (row: TRow) => TOut;
}

/**
 * List a soft-deletable table by descending createdAt with an opaque
 * cursor and a configurable extra-filters slot. Stable under concurrent
 * inserts because the cursor compares (createdAt, id) lexicographically.
 */
export async function paginatedSoftDeleteList<TRow extends { id: string; createdAt: Date }, TOut>({
  table,
  limit,
  cursor,
  filters: extraFilters = [],
  toOutput,
}: PaginatedListOpts<TRow, TOut>): Promise<{ data: TOut[]; next?: string }> {
  const filters: (SQL | undefined)[] = [isNull(table.deletedAt), ...extraFilters];
  if (cursor) {
    filters.push(
      sql`(${table.createdAt}, ${table.id}) < (${cursor.createdAt}, ${cursor.id})`,
    );
  }
  const rows = (await db()
    .select()
    .from(table)
    .where(and(...filters))
    .orderBy(desc(table.createdAt), desc(table.id))
    .limit(limit + 1)) as unknown as TRow[];

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data[data.length - 1];
  return {
    data: data.map(toOutput),
    next:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : undefined,
  };
}

/**
 * Soft-delete by id, throwing 404 if the row is missing or already
 * deleted. Returns nothing — handlers wrap the call in `return { ok: true }`.
 */
export async function softDeleteById(
  table: AnyPgTable & SoftDeleteTable,
  id: string,
  notFoundMessage: string,
): Promise<void> {
  const [row] = (await db()
    .update(table)
    .set({ deletedAt: new Date() } as never)
    .where(and(eq(table.id, id), isNull(table.deletedAt)))
    .returning({ id: table.id })) as { id: string }[];
  if (!row) throw new ORPCError("NOT_FOUND", { message: notFoundMessage });
}
