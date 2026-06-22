import { describe, expect, it, vi } from "vitest";
import { bulkGenerateCodes } from "@offerkit/core/codes";
import { createJobRegistry } from "@offerkit/core/jobs";
import { registerWorkerHandlers } from "./handlers.ts";

vi.mock("@offerkit/core/codes", async () => {
  const actual = await vi.importActual<typeof import("@offerkit/core/codes")>(
    "@offerkit/core/codes",
  );
  return {
    ...actual,
    bulkGenerateCodes: vi.fn(async () => ({ generated: 1 })),
  };
});

describe("registerWorkerHandlers", () => {
  it("forwards queued bulk-code reward payload fields", async () => {
    const registry = createJobRegistry();
    const db = {} as never;
    registerWorkerHandlers(registry, db);

    const handler = registry.get("bulk_codes.generate");
    expect(handler).toBeDefined();

    const discount = { type: "AMOUNT" as const, amount: 2_500 };
    await handler?.({
      jobId: "job-1",
      attempt: 1,
      payload: {
        campaignId: "campaign-1",
        count: 20_000,
        discount,
        giftBalance: 5_000,
      },
    });

    expect(bulkGenerateCodes).toHaveBeenCalledWith(db, {
      campaignId: "campaign-1",
      count: 20_000,
      discount,
      giftBalance: 5_000,
    });
  });
});
