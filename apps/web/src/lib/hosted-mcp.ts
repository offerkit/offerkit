export const HOSTED_MCP_SCOPE = "offerkit";
export const HOSTED_MCP_PATH = "/mcp";

export function isHostedMcpEnabled(value = process.env["OFFERKIT_MCP_ENABLED"]): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export function configuredOfferKitPublicUrl(): string | undefined {
  const value = process.env["OFFERKIT_PUBLIC_URL"]?.trim();
  return value ? value.replace(/\/$/, "") : undefined;
}

export function offerKitPublicUrl(): string {
  return configuredOfferKitPublicUrl() ?? "http://localhost:3000";
}

export function hostedMcpResourceUrl(): string {
  return `${offerKitPublicUrl()}${HOSTED_MCP_PATH}`;
}

export function hostedMcpResourceMetadataUrl(): string {
  return `${offerKitPublicUrl()}/.well-known/oauth-protected-resource/mcp`;
}

export function hostedMcpAuthorizationServerUrl(): string {
  return offerKitPublicUrl();
}
