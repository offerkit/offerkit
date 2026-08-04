import { and, desc, eq } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isHostedMcpEnabled } from "@/lib/hosted-mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sessionFor(request: Request) {
  return auth().api.getSession({ headers: request.headers });
}

export async function GET(request: Request): Promise<Response> {
  if (!isHostedMcpEnabled()) return new Response("Not Found", { status: 404 });
  const session = await sessionFor(request);
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const rows = await db()
    .select({
      id: schema.oauthConsent.id,
      clientId: schema.oauthConsent.clientId,
      name: schema.oauthClient.name,
      uri: schema.oauthClient.uri,
      scopes: schema.oauthConsent.scopes,
      createdAt: schema.oauthConsent.createdAt,
      updatedAt: schema.oauthConsent.updatedAt,
    })
    .from(schema.oauthConsent)
    .innerJoin(
      schema.oauthClient,
      eq(schema.oauthConsent.clientId, schema.oauthClient.clientId),
    )
    .where(eq(schema.oauthConsent.userId, session.user.id))
    .orderBy(desc(schema.oauthConsent.updatedAt));

  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isHostedMcpEnabled()) return new Response("Not Found", { status: 404 });
  const session = await sessionFor(request);
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !body.id) {
    return Response.json({ error: "Connection id is required" }, { status: 400 });
  }

  const consent = await db().query.oauthConsent.findFirst({
    where: and(
      eq(schema.oauthConsent.id, body.id),
      eq(schema.oauthConsent.userId, session.user.id),
    ),
  });
  if (!consent) return new Response("Not Found", { status: 404 });

  await db().transaction(async (tx) => {
    await tx
      .delete(schema.oauthAccessToken)
      .where(
        and(
          eq(schema.oauthAccessToken.clientId, consent.clientId),
          eq(schema.oauthAccessToken.userId, session.user.id),
        ),
      );
    await tx
      .delete(schema.oauthRefreshToken)
      .where(
        and(
          eq(schema.oauthRefreshToken.clientId, consent.clientId),
          eq(schema.oauthRefreshToken.userId, session.user.id),
        ),
      );
    await tx
      .delete(schema.oauthConsent)
      .where(
        and(
          eq(schema.oauthConsent.id, consent.id),
          eq(schema.oauthConsent.userId, session.user.id),
        ),
      );
  });

  return new Response(null, { status: 204 });
}
