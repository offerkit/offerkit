import { describe, expect, it } from "vitest";
import { mcpMeta, resolveMcpExposure } from "@offerkit/contract";

describe("resolveMcpExposure", () => {
  it("uses explicit contract metadata when present", () => {
    expect(
      resolveMcpExposure({
        meta: mcpMeta({
          expose: true,
          riskLevel: "safe",
          name: "custom_tool",
          description: "Custom tool",
        }),
        route: { method: "POST", summary: "Create something" },
      }),
    ).toEqual({
      expose: true,
      riskLevel: "safe",
      name: "custom_tool",
      description: "Custom tool",
    });
  });

  it("infers safe exposure for GET routes", () => {
    expect(resolveMcpExposure({ route: { method: "GET" } })).toEqual({
      expose: true,
      riskLevel: "safe",
    });
  });

  it("infers destructive exposure for DELETE routes", () => {
    expect(resolveMcpExposure({ route: { method: "DELETE" } })).toEqual({
      expose: true,
      riskLevel: "destructive",
    });
  });

  it("infers mutating exposure for non-read routes", () => {
    expect(resolveMcpExposure({ route: { method: "PATCH" } })).toEqual({
      expose: true,
      riskLevel: "mutating",
    });
  });
});
