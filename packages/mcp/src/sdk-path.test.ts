import { describe, expect, it, vi } from "vitest";
import { callBySdkPath } from "./sdk-path.ts";

describe("callBySdkPath", () => {
  it("walks function proxy clients before invoking the resolved procedure", async () => {
    const list = vi.fn(async (input: unknown) => ({ input, ok: true }));
    const client = Object.assign(() => undefined, {
      campaigns: { list },
    });

    await expect(callBySdkPath(client, ["campaigns", "list"], { limit: 5 })).resolves.toEqual({
      input: { limit: 5 },
      ok: true,
    });
    expect(list).toHaveBeenCalledWith({ limit: 5 });
  });

  it("reports unreachable paths", async () => {
    await expect(callBySdkPath({}, ["campaigns", "list"], {})).rejects.toThrow(
      "MCP tool path campaigns.list not reachable on SDK client",
    );
  });
});
