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

export interface AuthedContext extends RequestContext {
  user: { id: string; email: string; role: "admin" | "member" };
}

async function authenticateApiKey(
  authorization: string | null,
): Promise<{ id: string; email: string; role: "admin" | "member" } | null> {
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
    // API keys grant full access in v1; scopes will gate per-procedure later.
    role: "admin",
  };
}

export const requireSession = os
  .$context<RequestContext>()
  .middleware(async ({ context, next }) => {
    const authHeader = context.headers.get("authorization");
    const apiUser = await authenticateApiKey(authHeader);
    if (apiUser) {
      return next({ context: { user: apiUser } });
    }

    const session = await auth().api.getSession({ headers: context.headers });
    if (!session) {
      throw new ORPCError("UNAUTHORIZED", { message: "Sign in required" });
    }
    return next({
      context: {
        user: {
          id: session.user.id,
          email: session.user.email,
          role: (session.user as { role?: "admin" | "member" }).role ?? "member",
        },
      },
    });
  });
