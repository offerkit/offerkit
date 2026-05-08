import { createClient } from "@open-voucherify/sdk";

let cached: ReturnType<typeof createClient> | undefined;

export function ovx() {
  cached ??= createClient({
    // Same-origin in the browser, server-rendered code uses absolute URL.
    baseUrl: typeof window === "undefined" ? (process.env["OVX_PUBLIC_URL"] ?? "") : "",
  });
  return cached;
}
