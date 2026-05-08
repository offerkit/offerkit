import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function runMigrations(databaseUrl: string, migrationsFolder?: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const folder =
    migrationsFolder ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
