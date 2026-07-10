import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignGet: vi.fn(),
  createClient: vi.fn(),
  segmentUpdate: vi.fn(),
  voucherCreate: vi.fn(),
}));

vi.mock("@offerkit/sdk", () => ({
  createClient: mocks.createClient,
}));

import { main } from "./index";

beforeEach(() => {
  vi.stubEnv("OFFERKIT_API_URL", "https://offerkit.example.com");
  vi.stubEnv("OFFERKIT_API_KEY", "offerkit_test_secret");
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  mocks.campaignGet.mockResolvedValue({ id: "campaign-1" });
  mocks.segmentUpdate.mockResolvedValue({ id: "segment-1" });
  mocks.voucherCreate.mockResolvedValue({ code: "WAPP25" });
  mocks.createClient.mockReturnValue({
    campaigns: { get: mocks.campaignGet },
    segments: { update: mocks.segmentUpdate },
    vouchers: { create: mocks.voucherCreate },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("CLI command SDK wiring", () => {
  it("uses typed SDK procedures for built-ins and preserves dynamic api dispatch", async () => {
    await main(["node", "offerkit", "campaigns", "get", "campaign-1"]);
    expect(mocks.campaignGet).toHaveBeenCalledWith({ params: { id: "campaign-1" } });

    await main([
      "node",
      "offerkit",
      "segments",
      "update",
      "segment-1",
      "--data",
      '{"name":"VIP customers"}',
    ]);
    expect(mocks.segmentUpdate).toHaveBeenCalledWith({
      params: { id: "segment-1" },
      body: { patch: { name: "VIP customers" } },
    });

    await main([
      "node",
      "offerkit",
      "api",
      "vouchers.create",
      "--input",
      '{"code":"WAPP25","type":"DISCOUNT"}',
    ]);
    expect(mocks.voucherCreate).toHaveBeenCalledWith({ code: "WAPP25", type: "DISCOUNT" });
  });
});
