import { createClient } from "@offerkit/sdk";

let cached: ReturnType<typeof createClient> | undefined;

export function ovx() {
  cached ??= createClient({
    // oRPC's OpenAPILink runs `new URL(path, base)` and rejects an empty
    // base, so we need an absolute origin even in the browser. Use the
    // current page origin client-side; fall back to the configured public
    // URL (or a dev default) for server-rendered code paths.
    baseUrl:
      typeof window === "undefined"
        ? (process.env["OFFERKIT_PUBLIC_URL"] ?? "http://localhost:3000")
        : window.location.origin,
  });
  return cached;
}
