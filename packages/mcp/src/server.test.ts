import { describe, expect, it } from "vitest";
import type { Client } from "@offerkit/sdk";
import { createOfferKitMcpServer } from "./server.ts";

describe("createOfferKitMcpServer", () => {
  it("registers the contract-selected OfferKit tools with stable, unique names", () => {
    const { toolNames } = createOfferKitMcpServer({} as Client);

    expect(toolNames).toContain("vouchers_list");
    expect(toolNames).toContain("vouchers_validate");
    expect(toolNames).toContain("referrals_convert");
    expect(toolNames.length).toBeGreaterThan(10);
    expect(new Set(toolNames).size).toBe(toolNames.length);
  });
});
