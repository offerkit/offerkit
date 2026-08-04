import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRouterClient } from "@orpc/server";
import { createOfferKitMcpServer } from "@offerkit/mcp/server";
import type { Client } from "@offerkit/sdk";
import { isHostedMcpEnabled } from "@/lib/hosted-mcp";
import { getOfferKitVersion } from "@/lib/version";
import { router } from "@/server/router";
import {
  authenticateHostedMcpRequest,
  hostedMcpUnauthorized,
} from "@/server/hosted-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate(request: Request) {
  if (!isHostedMcpEnabled()) return new Response("Not Found", { status: 404 });

  const identity = await authenticateHostedMcpRequest(request);
  if (!identity) return hostedMcpUnauthorized();

  return identity;
}

async function handlePost(request: Request): Promise<Response> {
  const authenticated = await authenticate(request);
  if (authenticated instanceof Response) return authenticated;

  const client = createRouterClient(router, {
    context: {
      request,
      headers: request.headers,
      trustedUser: authenticated.user,
    },
  }) as Client;
  const { server } = createOfferKitMcpServer(client, { version: getOfferKitVersion() });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, {
      authInfo: authenticated.authInfo,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}

async function handleUnsupportedMethod(request: Request): Promise<Response> {
  const authenticated = await authenticate(request);
  if (authenticated instanceof Response) return authenticated;

  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

export const GET = handleUnsupportedMethod;
export const POST = handlePost;
export const DELETE = handleUnsupportedMethod;
