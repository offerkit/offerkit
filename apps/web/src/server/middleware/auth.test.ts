import { os } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestContext } from "@/server/context";

const mocks = vi.hoisted(() => ({
  auditInsert: vi.fn(),
  auditValues: vi.fn(),
  getSession: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: () => ({ api: { getSession: mocks.getSession } }),
}));

vi.mock("@/lib/db", () => ({
  db: () => ({ insert: mocks.auditInsert }),
}));

vi.mock("@offerkit/core/observability", () => ({
  logger: { child: () => ({ error: mocks.logError }) },
}));

import { requireSession } from "./auth";

function createMutationCall(output: unknown, trustedUser?: RequestContext["trustedUser"]) {
  const procedure = os
    .$context<RequestContext>()
    .use(requireSession)
    .handler(() => output)
    .callable({
      context: {
        request: new Request("http://test.local"),
        headers: new Headers(),
        trustedUser,
      },
      path: ["campaigns", "create"],
    });

  return () => procedure({});
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "user-1", email: "user@example.com", role: "admin" },
  });
  mocks.auditInsert.mockReturnValue({ values: mocks.auditValues });
});

describe("requireSession audit persistence", () => {
  it("waits for the audit insert before returning the business result", async () => {
    let finishAudit: (() => void) | undefined;
    mocks.auditValues.mockReturnValue(
      new Promise<void>((resolve) => {
        finishAudit = resolve;
      }),
    );
    const output = { id: "campaign-1" };

    let settled = false;
    const result = createMutationCall(output)();
    void result.then(() => {
      settled = true;
    });

    await vi.waitFor(() => expect(mocks.auditValues).toHaveBeenCalledOnce());
    expect(settled).toBe(false);

    finishAudit?.();

    await expect(result).resolves.toEqual(output);
    expect(settled).toBe(true);
  });

  it("logs an audit failure and still returns the business result", async () => {
    const error = new Error("audit database unavailable");
    mocks.auditValues.mockRejectedValue(error);
    const output = { id: "campaign-2" };

    await expect(createMutationCall(output)()).resolves.toEqual(output);

    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: error,
        actor: "user",
        actorId: "user-1",
        action: "create",
        entity: "campaigns",
        entityId: "campaign-2",
      }),
      "failed to persist audit log",
    );
  });

  it("uses an identity supplied by a trusted in-process transport", async () => {
    mocks.auditValues.mockResolvedValue(undefined);

    await expect(
      createMutationCall(
        { id: "campaign-3" },
        {
          id: "oauth-user-1",
          email: "oauth@example.com",
          role: "member",
          actorKind: "user",
          scopes: ["*"],
          rateLimitRps: null,
        },
      )(),
    ).resolves.toEqual({ id: "campaign-3" });

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.auditValues).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "oauth-user-1", actor: "user" }),
    );
  });
});
