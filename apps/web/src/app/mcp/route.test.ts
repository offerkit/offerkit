import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalEnabled = process.env["OFFERKIT_MCP_ENABLED"];
const originalPublicUrl = process.env["OFFERKIT_PUBLIC_URL"];

afterEach(() => {
  if (originalEnabled === undefined) delete process.env["OFFERKIT_MCP_ENABLED"];
  else process.env["OFFERKIT_MCP_ENABLED"] = originalEnabled;
  if (originalPublicUrl === undefined) delete process.env["OFFERKIT_PUBLIC_URL"];
  else process.env["OFFERKIT_PUBLIC_URL"] = originalPublicUrl;
});

describe("hosted MCP route", () => {
  it("is unavailable when the feature is disabled", async () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "false";

    const response = await GET(new Request("https://offerkit.example.com/mcp"));

    expect(response.status).toBe(404);
  });

  it("returns OAuth resource discovery on an unauthenticated request", async () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "true";
    process.env["OFFERKIT_PUBLIC_URL"] = "https://offerkit.example.com";

    const response = await GET(new Request("https://offerkit.example.com/mcp"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://offerkit.example.com/.well-known/oauth-protected-resource/mcp", scope="offerkit"',
    );
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_token" });
  });
});
