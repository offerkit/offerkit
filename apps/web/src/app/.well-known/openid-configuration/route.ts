import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";
import { isHostedMcpEnabled } from "@/lib/hosted-mcp";

export async function GET(request: Request): Promise<Response> {
  if (!isHostedMcpEnabled()) return new Response("Not Found", { status: 404 });
  return oauthProviderOpenIdConfigMetadata(auth())(request);
}
