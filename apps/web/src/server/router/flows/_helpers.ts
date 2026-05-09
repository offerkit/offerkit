import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodSmartCoercionPlugin } from "@orpc/zod";
import { schema, type Db } from "@offerkit/db";
import { createClient, type Client } from "@offerkit/sdk";
import { mintApiKey } from "@/lib/api-key";
import { router } from "../index";

// Shared scaffolding for SDK round-trip e2e tests under flows/.
// Each test file imports getTestDb to lazily migrate a target Postgres
// once per test process, mintTestKey to insert a scoped API key, and
// makeClient to build a typed @offerkit/sdk client backed by a fake
// fetch that drives the live oRPC handler in-process. No HTTP server,
// no Next.js boot.
//
// Tests skip cleanly without TEST_DATABASE_URL so the default
// `pnpm -r test` stays infra-free.

export const TEST_DB_URL = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
export const E2E_ENABLED = Boolean(TEST_DB_URL);

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  here,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "db",
  "drizzle",
);

interface TestDbHandle {
  db: Db;
  close: () => Promise<void>;
}

let cached: Promise<TestDbHandle> | null = null;

/**
 * Lazily migrates the target Postgres once per test process and hands
 * the same Db back to every caller. Two test files running in sequence
 * (we set fileParallelism: false on the vitest config) reuse the same
 * pool and avoid re-running migrations.
 */
export function getTestDb(url: string): Promise<TestDbHandle> {
  if (cached) return cached;
  // Better Auth needs the secret to mint hashes for password rows we
  // never use; the api-key.ts helper also reads it as the HMAC pepper.
  process.env["BETTER_AUTH_SECRET"] ??= "test-secret-1234567890123456789012";
  process.env["DATABASE_URL"] = url;
  cached = (async () => {
    const pool = new Pool({ connectionString: url });
    const migrator = drizzle(pool);
    await migrate(migrator, { migrationsFolder });
    const db = drizzle(pool, { schema, casing: "snake_case" });
    return {
      db,
      close: async () => {
        await pool.end();
      },
    };
  })();
  return cached;
}

export interface MintedTestKey {
  token: string;
  prefix: string;
}

export async function mintTestKey(
  db: Db,
  scopes: string[] = ["*"],
  rateLimitRps = 10_000,
): Promise<MintedTestKey> {
  const minted = mintApiKey();
  await db
    .insert(schema.apiKey)
    .values({
      id: `key_${minted.prefix}`,
      name: "e2e test",
      prefix: minted.prefix,
      hashedSecret: minted.hashedSecret,
      scopes,
      rateLimitRps,
    })
    .onConflictDoNothing();
  return { token: minted.token, prefix: minted.prefix };
}

export async function deleteTestKey(db: Db, prefix: string): Promise<void> {
  await db.delete(schema.apiKey).where(eq(schema.apiKey.prefix, prefix));
}

const sharedHandler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
});

/**
 * Build a typed @offerkit/sdk client wired to a fake fetch that drives
 * the live oRPC handler in-process. Forwards Request body + headers
 * (notably Authorization) so the authenticated path is exercised
 * end-to-end.
 */
export function makeClient(token: string): Client {
  const fakeFetch: typeof fetch = async (input, init) => {
    const req =
      input instanceof Request
        ? init
          ? new Request(input, init)
          : input
        : new Request(typeof input === "string" ? input : input.toString(), init);
    const { response } = await sharedHandler.handle(req, {
      prefix: "/api/v1",
      context: { request: req, headers: req.headers },
    });
    return response ?? new Response("not found", { status: 404 });
  };
  return createClient({
    baseUrl: "http://test.local",
    apiKey: token,
    fetch: fakeFetch,
  });
}

let counter = 0;
export function randomId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}-${String(counter)}`;
}

/**
 * Send a raw Request to the oRPC handler. Use when you need to set a
 * header (e.g. `Idempotency-Key`) that the SDK doesn't expose.
 */
export async function rawRequest(req: Request): Promise<Response> {
  const { response } = await sharedHandler.handle(req, {
    prefix: "/api/v1",
    context: { request: req, headers: req.headers },
  });
  return response ?? new Response("not found", { status: 404 });
}
