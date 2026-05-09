import { getDb as getRawDb, type Db } from "@offerkit/db";

let cached: Db | undefined;

export function db(): Db {
  cached ??= getRawDb();
  return cached;
}
