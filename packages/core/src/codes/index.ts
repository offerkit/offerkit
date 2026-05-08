import { randomInt } from "node:crypto";

export interface CodeConfig {
  length?: number;
  prefix?: string;
  suffix?: string;
  charset?: "alphanumeric" | "uppercase" | "lowercase" | "numeric";
  excludeConfusable?: boolean;
}

const ALPHABETS: Record<NonNullable<CodeConfig["charset"]>, string> = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  lowercase: "abcdefghijklmnopqrstuvwxyz0123456789",
  numeric: "0123456789",
};

const CONFUSABLE = new Set(["0", "O", "1", "l", "I"]);

function alphabet(config: CodeConfig): string {
  const charset = config.charset ?? "alphanumeric";
  const base = ALPHABETS[charset];
  if (config.excludeConfusable === false) return base;
  return [...base].filter((c) => !CONFUSABLE.has(c)).join("");
}

/** Generate a single voucher code matching the given config. */
export function generateCode(config: CodeConfig = {}): string {
  const length = config.length ?? 8;
  if (length < 1) throw new Error("code length must be >= 1");
  const chars = alphabet(config);
  let body = "";
  for (let i = 0; i < length; i++) {
    body += chars[randomInt(chars.length)];
  }
  return `${config.prefix ?? ""}${body}${config.suffix ?? ""}`;
}

/** Format a referral code as `{PREFIX}-{code}`. */
export function generateReferralCode(prefix: string, config: CodeConfig = {}): string {
  if (!prefix) throw new Error("referral codes require a prefix");
  if (prefix.includes("-")) throw new Error("referral prefix may not contain '-'");
  return `${prefix}-${generateCode(config)}`;
}

/**
 * Generate `count` unique codes, calling `exists` per candidate to check the
 * existing dataset. Retries on collision up to `maxAttempts * count` times.
 */
export async function generateUniqueCodes(
  count: number,
  config: CodeConfig,
  exists: (code: string) => Promise<boolean>,
  maxAttempts = 5,
): Promise<string[]> {
  const out = new Set<string>();
  let attempts = 0;
  const cap = count * maxAttempts;
  while (out.size < count && attempts < cap) {
    attempts++;
    const code = generateCode(config);
    if (out.has(code)) continue;
    if (await exists(code)) continue;
    out.add(code);
  }
  if (out.size < count) {
    throw new Error(
      `failed to generate ${String(count)} unique codes after ${String(cap)} attempts; consider widening length or charset`,
    );
  }
  return [...out];
}
