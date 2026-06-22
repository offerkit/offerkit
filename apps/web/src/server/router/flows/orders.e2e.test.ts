import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  makeClient,
  mintTestKey,
  randomId,
} from "./_helpers";

let db: Db | undefined;
let token: string | undefined;
let prefix: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db);
  token = minted.token;
  prefix = minted.prefix;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

describe.skipIf(!E2E_ENABLED)("orders CRUD + lifecycle + redemption attachment", () => {
  it("create → fulfill → cancel transitions, and redeem with orderId surfaces in orders.redemptions", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const created = await client.orders.create({
      items: [{ name: "widget", quantity: 1, unitPrice: 5_000 }],
      amount: 5_000,
      currency: "USD",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.status).toBe("CREATED");

    const fulfilled = await client.orders.fulfill({ params: { id: created.id } });
    expect(fulfilled.status).toBe("FULFILLED");

    const canceled = await client.orders.cancel({ params: { id: created.id } });
    expect(canceled.status).toBe("CANCELED");

    // Now create a fresh order to attach a redemption to.
    const order2 = await client.orders.create({
      items: [{ name: "widget", quantity: 1, unitPrice: 5_000 }],
      amount: 5_000,
      currency: "USD",
    });

    const campaign = await client.campaigns.create({
      name: randomId("camp-ord"),
      type: "DISCOUNT",
      currency: "USD",
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });
    const code = randomId("ORD").toUpperCase();
    await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 500 },
    });

    const redeemed = await client.vouchers.redeem({
      params: { code },
      body: {
        orderId: order2.id,
        order: { amount: 5_000, currency: "USD" },
      },
    });
    expect(redeemed.ok).toBe(true);

    const list = await client.orders.redemptions({ params: { id: order2.id } });
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.voucherCode).toBe(code);
    expect(list.data[0]?.result).toBe("SUCCESS");
  });

  it("updates, filters, gets, and soft-deletes orders", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const customer = await client.customers.create({
      email: `${randomId("order-customer")}@example.com`,
    });
    const externalId = randomId("order-ext");
    const order = await client.orders.create({
      externalId,
      customerId: customer.id,
      items: [{ name: "service", quantity: 2, unitPrice: 1_500 }],
      amount: 3_000,
      discountAmount: 100,
      currency: "USD",
      status: "CREATED",
      metadata: { channel: "e2e" },
    });

    const fetched = await client.orders.get({ params: { id: order.id } });
    expect(fetched.externalId).toBe(externalId);

    const updated = await client.orders.update({
      params: { id: order.id },
      body: { patch: { status: "PAID", discountAmount: 250, metadata: { channel: "api" } } },
    });
    expect(updated.status).toBe("PAID");
    expect(updated.discountAmount).toBe(250);

    const allOrders = await client.orders.list({});
    expect(allOrders.data.find((item) => item.id === order.id)).toBeDefined();
    const searchedOrders = await client.orders.list({ search: externalId });
    expect(searchedOrders.data.find((item) => item.id === order.id)).toBeDefined();

    await client.orders.delete({ params: { id: order.id } });
    await expect(client.orders.get({ params: { id: order.id } })).rejects.toThrow(
      /not found/i,
    );
  });
});
