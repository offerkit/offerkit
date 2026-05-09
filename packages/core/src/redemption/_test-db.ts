import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schema, type Db } from "@offerkit/db";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "..", "..", "..", "db", "drizzle");

export interface TestDbHandle {
  db: Db;
  close: () => Promise<void>;
}

let cached: Promise<TestDbHandle> | null = null;

/**
 * Lazily migrates the target Postgres once per worker, then hands the
 * same Db back to every caller. Two test files running in parallel
 * would otherwise race on `drizzle` schema creation.
 */
export function getTestDb(url: string): Promise<TestDbHandle> {
  if (cached) return cached;
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
