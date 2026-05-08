import { ORPCError } from "@orpc/server";
import { and, desc, isNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";

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

// Tables we paginate over share three columns (id, createdAt, deletedAt).
// The helpers use Drizzle's typed builder (which handles snake_case ↔
// camelCase aliasing); a single localized cast bridges the generic table
// constraint to the caller's row type, since Drizzle's `AnyPgTable` doesn't
// carry enough information for `select().from()` to type the result rows.
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
  // Drizzle's typed builder applies snake_case→camelCase aliasing (config
  // in db.ts), but its result type for a generic `AnyPgTable` collapses to
  // the column-shape baseline. The runtime rows match TRow because the
  // caller picked `table` to be the table whose $inferSelect is TRow.
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
 *
 * Uses raw SQL (not `db.update().set()`) so the helper doesn't need the
 * `set()` argument to satisfy Drizzle's `$inferInsert` constraint, which
 * the generic table type can't prove. `sql.identifier(...)` gives us the
 * bare column name needed in the SET clause.
 */
export async function softDeleteById(
  table: AnyPgTable & SoftDeleteTable,
  id: string,
  notFoundMessage: string,
): Promise<void> {
  const deletedAtName = sql.identifier(table.deletedAt.name);
  const result = await db().execute<{ id: string }>(sql`
    UPDATE ${table}
    SET ${deletedAtName} = NOW()
    WHERE ${table.id} = ${id} AND ${table.deletedAt} IS NULL
    RETURNING ${table.id}
  `);
  if (result.rows.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: notFoundMessage });
  }
}
