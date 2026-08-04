import { afterEach, describe, expect, it } from "vitest";
import { hostedMcpProtectedResourceMetadata } from "./hosted-mcp-metadata";

const originalEnabled = process.env["OFFERKIT_MCP_ENABLED"];
const originalPublicUrl = process.env["OFFERKIT_PUBLIC_URL"];

afterEach(() => {
  if (originalEnabled === undefined) delete process.env["OFFERKIT_MCP_ENABLED"];
  else process.env["OFFERKIT_MCP_ENABLED"] = originalEnabled;
  if (originalPublicUrl === undefined) delete process.env["OFFERKIT_PUBLIC_URL"];
  else process.env["OFFERKIT_PUBLIC_URL"] = originalPublicUrl;
});

describe("hosted MCP protected-resource metadata", () => {
  it("is unavailable while hosted MCP is disabled", () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "false";

    expect(hostedMcpProtectedResourceMetadata().status).toBe(404);
  });

  it("advertises the canonical resource, authorization server, and scope", async () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "true";
    process.env["OFFERKIT_PUBLIC_URL"] = "https://offerkit.example.com";

    const response = hostedMcpProtectedResourceMetadata();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource: "https://offerkit.example.com/mcp",
      authorization_servers: ["https://offerkit.example.com"],
      scopes_supported: ["offerkit"],
      bearer_methods_supported: ["header"],
      resource_name: "OfferKit MCP",
    });
  });
});
