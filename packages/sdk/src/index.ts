import { createHmac, timingSafeEqual } from "node:crypto";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { contract, type Contract } from "@offerkit/contract";

export interface SdkOptions {
  /** Base URL of the Offerkit deployment, e.g. https://offerkit.example.com */
  baseUrl: string;
  /** API key for programmatic access. Optional for browser callers using cookie auth. */
  apiKey?: string;
  /** Custom fetch implementation (e.g. node-fetch, undici, edge runtime). */
  fetch?: typeof fetch;
}

export type Client = ContractRouterClient<Contract>;

export function createClient(options: SdkOptions): Client {
  const link = new OpenAPILink(contract, {
    url: `${options.baseUrl.replace(/\/$/, "")}/api/v1`,
    headers: () => {
      const headers: Record<string, string> = {};
      if (options.apiKey) headers["Authorization"] = `Bearer ${options.apiKey}`;
      return headers;
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return createORPCClient(link) satisfies Client;
}

export interface VerifyWebhookOptions {
  /** Reject signatures whose timestamp is older than this many seconds. Default 300. */
  toleranceSeconds?: number;
  /** Override the current time (millis). Tests only. */
  now?: number;
}

/**
 * Verify the X-Offerkit-Signature header against the raw request body.
 *
 * Format: `t=<unix-seconds>,v1=<hex>`. v1 = HMAC-SHA256(secret, "${t}.${rawBody}").
 * Returns true on match within the tolerance window.
 */
export function verifyWebhook(
  rawBody: string,
  signature: string,
  secret: string,
  options: VerifyWebhookOptions = {},
): boolean {
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Date.now();
  const parts: Record<string, string> = {};
  for (const segment of signature.split(",")) {
    const idx = segment.indexOf("=");
    if (idx <= 0) continue;
    parts[segment.slice(0, idx)] = segment.slice(idx + 1);
  }
  const t = Number(parts["t"]);
  const v1 = parts["v1"];
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(now / 1000 - t) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${String(t)}.${rawBody}`).digest("hex");
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}
