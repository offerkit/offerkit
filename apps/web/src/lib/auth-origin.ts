import { configuredOfferKitPublicUrl } from "./hosted-mcp";

export function inferredRequestOrigin(request?: Request): string[] {
  if (configuredOfferKitPublicUrl() || !request) return [];

  try {
    return [new URL(request.url).origin];
  } catch {
    return [];
  }
}
