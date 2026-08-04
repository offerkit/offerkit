import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@offerkit/db";

const original = {
  databaseUrl: process.env["DATABASE_URL"],
  secret: process.env["BETTER_AUTH_SECRET"],
  publicUrl: process.env["OFFERKIT_PUBLIC_URL"],
  enabled: process.env["OFFERKIT_MCP_ENABLED"],
};

beforeAll(() => {
  // Metadata generation builds the adapter but does not query this deliberately closed port.
  process.env["DATABASE_URL"] = "postgres://offerkit:dev@127.0.0.1:65432/offerkit";
  process.env["BETTER_AUTH_SECRET"] = "hosted-mcp-discovery-test-secret-000000";
  process.env["OFFERKIT_PUBLIC_URL"] = "https://offerkit.example.com";
  process.env["OFFERKIT_MCP_ENABLED"] = "true";
});

afterAll(async () => {
  await closeDb();
  for (const [key, value] of Object.entries({
    DATABASE_URL: original.databaseUrl,
    BETTER_AUTH_SECRET: original.secret,
    OFFERKIT_PUBLIC_URL: original.publicUrl,
    OFFERKIT_MCP_ENABLED: original.enabled,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("hosted MCP OAuth discovery", () => {
  it("advertises root issuer metadata with PKCE and dynamic registration", async () => {
    const { GET } = await import(
      "@/app/.well-known/oauth-authorization-server/route"
    );
    const response = await GET(
      new Request("https://offerkit.example.com/.well-known/oauth-authorization-server"),
    );
    const metadata = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(metadata).toMatchObject({
      issuer: "https://offerkit.example.com",
      authorization_endpoint: "https://offerkit.example.com/api/auth/oauth2/authorize",
      token_endpoint: "https://offerkit.example.com/api/auth/oauth2/token",
      registration_endpoint: "https://offerkit.example.com/api/auth/oauth2/register",
      code_challenge_methods_supported: ["S256"],
    });
    expect(metadata.scopes_supported).toEqual(
      expect.arrayContaining(["offerkit", "offline_access"]),
    );
  });
});
