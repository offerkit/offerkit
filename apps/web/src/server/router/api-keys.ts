import { randomUUID } from "node:crypto";
import { ORPCError, implement } from "@orpc/server";
import { desc, eq, isNull } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { mintApiKey } from "@/lib/api-key";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";

const os = implement(contract).$context<RequestContext>();

type ApiKeyRow = typeof schema.apiKey.$inferSelect;

function toApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    rateLimitRps: row.rateLimitRps,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const list = os.apiKeys.list.use(requireSession).handler(async () => {
  const rows = (await db()
    .select()
    .from(schema.apiKey)
    .where(isNull(schema.apiKey.disabledAt))
    .orderBy(desc(schema.apiKey.createdAt))) as ApiKeyRow[];
  return { data: rows.map(toApiKey) };
});

const create = os.apiKeys.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const minted = mintApiKey();
    const id = randomUUID();
    const [row] = await db()
      .insert(schema.apiKey)
      .values({
        id,
        name: input.name,
        prefix: minted.prefix,
        hashedSecret: minted.hashedSecret,
        scopes: input.scopes ?? ["*"],
        rateLimitRps: input.rateLimitRps ?? 100,
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return { ...toApiKey(row), token: minted.token };
  });

const revoke = os.apiKeys.revoke
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .update(schema.apiKey)
      .set({ disabledAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.apiKey.id, input.params.id))
      .returning({ id: schema.apiKey.id });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "API key not found" });
    return { ok: true as const };
  });

export const apiKeysRouter = { list, create, revoke };
