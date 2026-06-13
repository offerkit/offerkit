import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import { verifyWebhook } from "@offerkit/sdk";
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

describe.skipIf(!E2E_ENABLED)("webhooks: register + signature verification", () => {
  it("create webhook returns plaintext secret once and signature verifies", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const created = await client.webhooks.create({
      name: randomId("wh"),
      url: "https://example.test/hook",
      events: ["voucher.redeemed"],
      active: true,
    });
    expect(created.secret).toBeTruthy();
    expect(created.secret.length).toBeGreaterThan(20);

    // List/get round-trip works.
    const list = await client.webhooks.list({});
    expect(list.data.find((w) => w.id === created.id)).toBeDefined();
    const fetched = await client.webhooks.get({ params: { id: created.id } });
    expect(fetched.id).toBe(created.id);
    // Plaintext is never returned again — only the prefix.
    expect((fetched as unknown as { secret?: string }).secret).toBeUndefined();

    // verifyWebhook from the SDK accepts a body signed with the secret.
    const body = JSON.stringify({ type: "voucher.redeemed", id: "evt-1" });
    const ts = Math.floor(Date.now() / 1000);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(created.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${ts}.${body}`),
    );
    const hex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const header = `t=${ts},v1=${hex}`;

    const verified = verifyWebhook(body, header, created.secret);
    expect(verified).toBe(true);

    // Wrong secret rejects.
    const bad = verifyWebhook(body, header, "not-the-secret");
    expect(bad).toBe(false);

    // Soft-delete cleanup.
    await client.webhooks.delete({ params: { id: created.id } });
  });
});
