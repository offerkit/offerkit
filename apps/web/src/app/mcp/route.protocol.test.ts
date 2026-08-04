import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/hosted-mcp-auth", () => ({
  authenticateHostedMcpRequest: vi.fn(async (request: Request) =>
    request.headers.has("authorization")
      ? {
          authInfo: {
            token: "test-token",
            clientId: "test-client",
            scopes: ["offerkit"],
            resource: new URL("https://offerkit.example.com/mcp"),
          },
          user: {
            id: "user-1",
            email: "user@example.com",
            role: "admin",
            actorKind: "user",
            scopes: ["*"],
            rateLimitRps: null,
          },
        }
      : null,
  ),
  hostedMcpUnauthorized: () => new Response(null, { status: 401 }),
}));

import { GET, POST } from "./route";

const originalEnabled = process.env["OFFERKIT_MCP_ENABLED"];

afterEach(() => {
  if (originalEnabled === undefined) delete process.env["OFFERKIT_MCP_ENABLED"];
  else process.env["OFFERKIT_MCP_ENABLED"] = originalEnabled;
});

function mcpRequest(body: unknown): Request {
  return new Request("https://offerkit.example.com/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify(body),
  });
}

describe("hosted MCP protocol", () => {
  it("initializes and lists contract-derived tools over stateless JSON responses", async () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "true";

    const initialized = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    );
    const initializeBody = (await initialized.json()) as {
      result?: { serverInfo?: { name?: string } };
    };

    expect(initialized.status).toBe(200);
    expect(initializeBody.result?.serverInfo?.name).toBe("offerkit");

    const listed = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    const listBody = (await listed.json()) as {
      result?: {
        tools?: {
          name: string;
          annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
        }[];
      };
    };

    expect(listed.status).toBe(200);
    expect(listBody.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["vouchers_list", "vouchers_validate", "referrals_convert"]),
    );
    expect(listBody.result?.tools?.find((tool) => tool.name === "vouchers_list")?.annotations)
      .toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(listBody.result?.tools?.find((tool) => tool.name === "vouchers_delete")?.annotations)
      .toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it("declines the optional SSE channel in stateless mode", async () => {
    process.env["OFFERKIT_MCP_ENABLED"] = "true";

    const response = await GET(
      new Request("https://offerkit.example.com/mcp", {
        headers: { Authorization: "Bearer test-token", Accept: "text/event-stream" },
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
