import {
  HOSTED_MCP_SCOPE,
  hostedMcpAuthorizationServerUrl,
  hostedMcpResourceUrl,
  isHostedMcpEnabled,
} from "@/lib/hosted-mcp";

export function hostedMcpProtectedResourceMetadata(): Response {
  if (!isHostedMcpEnabled()) return new Response("Not Found", { status: 404 });

  return Response.json(
    {
      resource: hostedMcpResourceUrl(),
      authorization_servers: [hostedMcpAuthorizationServerUrl()],
      scopes_supported: [HOSTED_MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "OfferKit MCP",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
      },
    },
  );
}
