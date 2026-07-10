import { schema } from "@offerkit/db";
import { contract, resolveContractOperationRisk } from "@offerkit/contract";
import { logger } from "@offerkit/core/observability";
import { db } from "@/lib/db";

const log = logger.child({ component: "audit" });
export function isMutationPath(path: readonly string[]): boolean {
  const risk = resolveContractOperationRisk(contract, path);
  return risk === "mutating" || risk === "destructive";
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

export async function writeAudit(args: WriteAuditArgs): Promise<void> {
  const [entity, ...rest] = args.path;
  if (!entity || rest.length === 0) return;
  const action = rest.join(".");
  const entityId = extractEntityId(args.input, args.output);
  try {
    await db().insert(schema.auditLog).values({
      actor: args.actor,
      actorId: args.actorId,
      action,
      entity,
      entityId,
      before: null,
      after: sanitizeJson(args.input),
      ip: args.ip,
      userAgent: args.userAgent,
    });
  } catch (err) {
    log.error(
      {
        err,
        actor: args.actor,
        actorId: args.actorId,
        action,
        entity,
        entityId,
      },
      "failed to persist audit log",
    );
  }
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
