import { schema } from "@offerkit/db";
import { db } from "@/lib/db";

const MUTATION_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "disable",
  "enable",
  "redeem",
  "rollback",
  "stackRedeem",
  "earn",
  "spend",
  "adjust",
  "refund",
  "send",
  "retry",
  "replay",
  "restore",
  "regenerate",
  "generate",
  "import",
  "sync",
  "rotate",
  "approve",
  "reject",
  "complete",
]);

export function isMutationPath(path: readonly string[]): boolean {
  if (path.length === 0) return false;
  const last = path[path.length - 1];
  return last !== undefined && MUTATION_ACTIONS.has(last);
}

interface WriteAuditArgs {
  actor: "user" | "api_key" | "system";
  actorId: string | null;
  path: readonly string[];
  input: unknown;
  output: unknown;
  ip: string | null;
  userAgent: string | null;
}

function extractEntityId(input: unknown, output: unknown): string | null {
  const fromInput = extractId(input);
  if (fromInput) return fromInput;
  return extractId(output);
}

function extractId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

export function writeAudit(args: WriteAuditArgs): void {
  const [entity, ...rest] = args.path;
  if (!entity || rest.length === 0) return;
  const action = rest.join(".");
  const entityId = extractEntityId(args.input, args.output);
  // Drizzle queries execute lazily — `.then()` / await is what triggers
  // the SQL. Use a fire-and-forget `.catch` to keep the call non-blocking
  // while still actually running the insert.
  db()
    .insert(schema.auditLog)
    .values({
      actor: args.actor,
      actorId: args.actorId,
      action,
      entity,
      entityId,
      before: null,
      after: sanitizeJson(args.input),
      ip: args.ip,
      userAgent: args.userAgent,
    })
    .catch(() => {
      // Audit failure must not break the request path.
    });
}

function sanitizeJson(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

export function ipFromHeaders(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0];
    return first ? first.trim() : null;
  }
  return headers.get("x-real-ip");
}
