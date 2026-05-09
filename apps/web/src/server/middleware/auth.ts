import { ORPCError, os } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import type { RequestContext } from "@/server/context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  constantTimeEqualHex,
  hashApiKeySecret,
  parseApiKeyHeader,
} from "@/lib/api-key";
import { ipFromHeaders, isMutationPath, writeAudit } from "./audit";
import { checkAndRecordIdempotency } from "./idempotency";
import { requiredScopeFor, scopeAllows } from "./scopes";
import { takeToken } from "./rate-limit";

interface AuthedUser {
  id: string;
  email: string;
  role: "admin" | "member";
  actorKind: "user" | "api_key";
  scopes: readonly string[];
  rateLimitRps: number | null;
}

export interface AuthedContext extends RequestContext {
  user: AuthedUser;
}

async function authenticateApiKey(authorization: string | null): Promise<AuthedUser | null> {
  const parsed = parseApiKeyHeader(authorization);
  if (!parsed) return null;
  const row = await db().query.apiKey.findFirst({
    where: and(eq(schema.apiKey.prefix, parsed.prefix), isNull(schema.apiKey.disabledAt)),
  });
  if (!row) return null;
  const computed = hashApiKeySecret(parsed.secret);
  if (!constantTimeEqualHex(computed, row.hashedSecret)) return null;
  // Best-effort lastUsedAt update; don't block the request on it.
  void db()
    .update(schema.apiKey)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.apiKey.id, row.id));
  return {
    id: row.id,
    email: `apikey:${row.prefix}`,
    role: "admin",
    actorKind: "api_key",
    scopes: row.scopes ?? [],
    rateLimitRps: row.rateLimitRps,
  };
}

export const requireSession = os
  .$context<RequestContext>()
  .middleware(async ({ context, next, path }, input) => {
    const authHeader = context.headers.get("authorization");
    const apiUser = await authenticateApiKey(authHeader);
    let user: AuthedUser;
    if (apiUser) {
      user = apiUser;
    } else {
      const session = await auth().api.getSession({ headers: context.headers });
      if (!session) {
        throw new ORPCError("UNAUTHORIZED", { message: "Sign in required" });
      }
      user = {
        id: session.user.id,
        email: session.user.email,
        role: (session.user as { role?: "admin" | "member" }).role ?? "member",
        actorKind: "user",
        scopes: ["*"],
        rateLimitRps: null,
      };
    }

    if (user.actorKind === "api_key") {
      const required = requiredScopeFor(path);
      if (required && !scopeAllows(user.scopes, required)) {
        throw new ORPCError("FORBIDDEN", {
          message: `API key missing required scope: ${required}`,
        });
      }
      if (user.rateLimitRps !== null) {
        takeToken(user.id, user.rateLimitRps);
      }
    }

    const idempotencyKey = context.headers.get("idempotency-key");
    if (isMutationPath(path) && idempotencyKey) {
      const cached = await checkAndRecordIdempotency(path, idempotencyKey, input, async () =>
        next({ context: { user } }),
      );
      if (cached.kind === "replay") {
        return { output: cached.output, context: { user } };
      }
      writeAudit({
        actor: user.actorKind,
        actorId: user.id,
        path,
        input,
        output: cached.result.output,
        ip: ipFromHeaders(context.headers),
        userAgent: context.headers.get("user-agent"),
      });
      return cached.result;
    }

    const result = await next({ context: { user } });

    if (isMutationPath(path)) {
      writeAudit({
        actor: user.actorKind,
        actorId: user.id,
        path,
        input,
        output: result.output,
        ip: ipFromHeaders(context.headers),
        userAgent: context.headers.get("user-agent"),
      });
    }

    return result;
  });
