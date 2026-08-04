import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  HOSTED_MCP_SCOPE,
  hostedMcpResourceMetadataUrl,
  hostedMcpResourceUrl,
  offerKitPublicUrl,
} from "@/lib/hosted-mcp";
import type { TrustedRequestUser } from "@/server/context";

export interface HostedMcpIdentity {
  authInfo: AuthInfo;
  user: TrustedRequestUser;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  return match?.[1] ?? null;
}

function tokenScopes(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split(/\s+/).filter(Boolean);
}

export async function authenticateHostedMcpRequest(
  request: Request,
): Promise<HostedMcpIdentity | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const verified = await auth().api.verifyJWT({
    body: { token, issuer: offerKitPublicUrl() },
  });
  const payload = verified.payload;
  if (!payload?.sub || typeof payload.azp !== "string") return null;

  const scopes = tokenScopes(payload.scope);
  if (!scopes.includes(HOSTED_MCP_SCOPE)) return null;

  const [account, client, consent] = await Promise.all([
    db().query.user.findFirst({
      where: and(eq(schema.user.id, payload.sub), isNull(schema.user.disabledAt)),
    }),
    db().query.oauthClient.findFirst({
      where: and(
        eq(schema.oauthClient.clientId, payload.azp),
        eq(schema.oauthClient.disabled, false),
      ),
    }),
    db().query.oauthConsent.findFirst({
      where: and(
        eq(schema.oauthConsent.userId, payload.sub),
        eq(schema.oauthConsent.clientId, payload.azp),
      ),
    }),
  ]);
  if (!account || !client || !consent?.scopes.includes(HOSTED_MCP_SCOPE)) return null;

  return {
    authInfo: {
      token,
      clientId: payload.azp,
      scopes,
      ...(typeof payload.exp === "number" ? { expiresAt: payload.exp } : {}),
      resource: new URL(hostedMcpResourceUrl()),
      extra: { subject: payload.sub },
    },
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
      actorKind: "user",
      scopes: ["*"],
      rateLimitRps: null,
    },
  };
}

export function hostedMcpUnauthorized(): Response {
  return Response.json(
    { error: "invalid_token", error_description: "A valid OfferKit OAuth token is required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate":
          `Bearer resource_metadata="${hostedMcpResourceMetadataUrl()}", ` +
          `scope="${HOSTED_MCP_SCOPE}"`,
      },
    },
  );
}
