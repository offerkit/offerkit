import type { schema } from "@open-voucherify/db";

export type CustomerRow = typeof schema.customer.$inferSelect;
export type SegmentRow = typeof schema.segment.$inferSelect;

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
