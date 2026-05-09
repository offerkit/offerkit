import { ORPCError } from "@orpc/server";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

export function takeToken(keyId: string, rps: number): void {
  const burst = Math.max(rps, 1);
  const now = Date.now();
  const bucket = buckets.get(keyId);
  if (!bucket) {
    buckets.set(keyId, { tokens: burst - 1, lastRefillMs: now });
    return;
  }
  const elapsedMs = now - bucket.lastRefillMs;
  const refilled = (elapsedMs / 1000) * rps;
  bucket.tokens = Math.min(burst, bucket.tokens + refilled);
  bucket.lastRefillMs = now;
  if (bucket.tokens < 1) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: `Rate limit exceeded (${rps} rps)`,
    });
  }
  bucket.tokens -= 1;
}
