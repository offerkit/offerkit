import { afterEach, describe, expect, it } from "vitest";
import {
  hostedMcpAuthorizationServerUrl,
  hostedMcpResourceMetadataUrl,
  hostedMcpResourceUrl,
  isHostedMcpEnabled,
  offerKitPublicUrl,
} from "./hosted-mcp";

const originalPublicUrl = process.env["OFFERKIT_PUBLIC_URL"];

afterEach(() => {
  if (originalPublicUrl === undefined) delete process.env["OFFERKIT_PUBLIC_URL"];
  else process.env["OFFERKIT_PUBLIC_URL"] = originalPublicUrl;
});

describe("hosted MCP configuration", () => {
  it.each(["1", "true", "TRUE", "yes", "on", " on "])(
    "enables the endpoint for %s",
    (value) => {
      expect(isHostedMcpEnabled(value)).toBe(true);
    },
  );

  it.each([undefined, "", "0", "false", "no", "enabled"])(
    "keeps the endpoint disabled for %s",
    (value) => {
      expect(isHostedMcpEnabled(value)).toBe(false);
    },
  );

  it("builds canonical OAuth and MCP URLs from the public origin", () => {
    process.env["OFFERKIT_PUBLIC_URL"] = "https://offerkit.example.com/";

    expect(offerKitPublicUrl()).toBe("https://offerkit.example.com");
    expect(hostedMcpResourceUrl()).toBe("https://offerkit.example.com/mcp");
    expect(hostedMcpResourceMetadataUrl()).toBe(
      "https://offerkit.example.com/.well-known/oauth-protected-resource/mcp",
    );
    expect(hostedMcpAuthorizationServerUrl()).toBe("https://offerkit.example.com");
  });
});
