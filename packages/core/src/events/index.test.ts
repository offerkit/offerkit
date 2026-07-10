import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@offerkit/db";
import { verifyWebhook } from "@offerkit/sdk";
import { deliverWebhook, mintWebhookSecret } from "./index.ts";

const ENCRYPTION_KEY = "test-webhook-encryption-key-with-at-least-32-characters";

function deliveryDb(encryptedSecret: string | null) {
  const updates: Record<string, unknown>[] = [];
  const update = vi.fn(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      updates.push(values);
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));

  const db = {
    query: {
      webhookDelivery: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000001",
          webhookId: "00000000-0000-4000-8000-000000000002",
          eventId: "00000000-0000-4000-8000-000000000003",
          status: "pending",
          attempts: 0,
          nextRetryAt: null,
          responseStatus: null,
          responseBody: null,
          error: null,
          createdAt: new Date("2026-07-10T10:00:00.000Z"),
          updatedAt: new Date("2026-07-10T10:00:00.000Z"),
        }),
      },
      webhook: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000002",
          name: "Orders",
          url: "https://example.test/webhooks",
          hashedSecret: null,
          encryptedSecret,
          secretPrefix: "whsec_example",
          events: ["order.created"],
          active: true,
          deletedAt: null,
          createdAt: new Date("2026-07-10T10:00:00.000Z"),
          updatedAt: new Date("2026-07-10T10:00:00.000Z"),
        }),
      },
      event: {
        findFirst: vi.fn().mockResolvedValue({
          id: "00000000-0000-4000-8000-000000000003",
          type: "order.created",
          payload: { orderId: "order_123" },
          entityId: "order_123",
          createdAt: new Date("2026-07-10T10:00:00.000Z"),
        }),
      },
    },
    update,
  } as unknown as Db;

  return { db, updates };
}

beforeEach(() => {
  process.env["WEBHOOK_SECRET_ENCRYPTION_KEY"] = ENCRYPTION_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["WEBHOOK_SECRET_ENCRYPTION_KEY"];
});

describe("webhook secret delivery", () => {
  it("encrypts the secret returned at creation and signs a real delivery with it", async () => {
    const minted = mintWebhookSecret();
    expect(minted.encryptedSecret).not.toContain(minted.plaintext);

    const { db, updates } = deliveryDb(minted.encryptedSecret);
    let deliveredBody = "";
    let deliveredSignature = "";
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      deliveredBody = typeof init?.body === "string" ? init.body : "";
      deliveredSignature = new Headers(init?.headers).get("x-offerkit-signature") ?? "";
      return Promise.resolve(new Response("accepted", { status: 202 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await deliverWebhook(db, {
      deliveryId: "00000000-0000-4000-8000-000000000001",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(verifyWebhook(deliveredBody, deliveredSignature, minted.plaintext)).toBe(true);
    expect(verifyWebhook(deliveredBody, deliveredSignature, minted.encryptedSecret)).toBe(false);
    expect(updates).toContainEqual(expect.objectContaining({ status: "succeeded", attempts: 1 }));
  });

  it("dead-letters legacy hash-only webhooks instead of signing with the hash", async () => {
    const { db, updates } = deliveryDb(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await deliverWebhook(db, {
      deliveryId: "00000000-0000-4000-8000-000000000001",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const deadUpdate = updates.find((update) => update["status"] === "dead");
    expect(deadUpdate).toMatchObject({
      status: "dead",
      error: "webhook signing secret predates encrypted storage; recreate the webhook",
    });
    expect(deadUpdate?.["updatedAt"]).toBeInstanceOf(Date);
  });
});
