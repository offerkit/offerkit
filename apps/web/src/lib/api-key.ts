import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// API keys are presented as `offerkit_<prefix12>_<secret40>`. The prefix
// is stored in plaintext for fast lookup; the secret is HMAC-SHA256'd
// with BETTER_AUTH_SECRET (already a required env var) so the database
// alone can't authenticate a request.

const PREFIX_LEN = 12;
const SECRET_LEN = 40;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randString(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    const byte = bytes[i] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

function pepper(): string {
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set to hash API keys");
  return secret;
}

export function hashApiKeySecret(secret: string): string {
  return createHmac("sha256", pepper()).update(secret, "utf8").digest("hex");
}

export interface MintedKey {
  /** The plaintext token. Show once, never store. */
  token: string;
  prefix: string;
  hashedSecret: string;
}

export function mintApiKey(): MintedKey {
  const prefix = randString(PREFIX_LEN);
  const secret = randString(SECRET_LEN);
  return {
    token: `offerkit_${prefix}_${secret}`,
    prefix,
    hashedSecret: hashApiKeySecret(secret),
  };
}

export interface ParsedApiKey {
  prefix: string;
  secret: string;
}

export function parseApiKeyHeader(authorization: string | null): ParsedApiKey | null {
  if (!authorization) return null;
  const trimmed = authorization.trim();
  const m = /^Bearer\s+(\S+)$/i.exec(trimmed);
  if (!m) return null;
  const token = m[1] ?? "";
  const parts = token.split("_");
  if (parts.length !== 3 || parts[0] !== "offerkit") return null;
  const prefix = parts[1] ?? "";
  const secret = parts[2] ?? "";
  if (prefix.length !== PREFIX_LEN || secret.length !== SECRET_LEN) return null;
  return { prefix, secret };
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
