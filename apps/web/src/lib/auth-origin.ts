import { configuredOfferKitPublicUrl } from "./hosted-mcp";

// Characters that would let a Host value smuggle a path, credentials, query, or
// fragment into the origin we construct from it.
const UNSAFE_HOST = /[\s/\\@?#]/;

function firstHeaderValue(request: Request, name: string): string | undefined {
  return request.headers.get(name)?.split(",")[0]?.trim() || undefined;
}

function requestScheme(request: Request): "http" | "https" {
  // A TLS-terminating proxy forwards plain HTTP, so the browser's scheme is only
  // visible through X-Forwarded-Proto. Honoring it changes the scheme only, never
  // the host, so a forged value can at most compare against the same host.
  const forwarded = firstHeaderValue(request, "x-forwarded-proto")?.toLowerCase();
  if (forwarded === "https" || forwarded === "http") return forwarded;
  try {
    return new URL(request.url).protocol === "https:" ? "https" : "http";
  } catch {
    return "http";
  }
}

/**
 * Returns the origin the browser connected to, for Better Auth's same-origin check
 * when no canonical URL is configured.
 *
 * The host comes from the `Host` header rather than `request.url`: the Next.js
 * standalone server builds `request.url` from its bind address (`localhost`), so
 * LAN and `127.0.0.1` requests would otherwise never match their own Origin.
 * Browsers set `Host` themselves and pages cannot override it, so a cross-site
 * page still sends an Origin that differs from it. `X-Forwarded-Host` is ignored
 * because it is an ordinary, client-settable header.
 */
export function inferredRequestOrigin(request?: Request): string[] {
  if (configuredOfferKitPublicUrl() || !request) return [];

  const host = firstHeaderValue(request, "host");
  if (!host || UNSAFE_HOST.test(host)) return [];

  try {
    const origin = new URL(`${requestScheme(request)}://${host}`);
    return [origin.origin];
  } catch {
    return [];
  }
}
