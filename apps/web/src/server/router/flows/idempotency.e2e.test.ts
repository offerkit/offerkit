import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  mintTestKey,
  randomId,
  rawRequest,
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

function buildRequest(
  body: unknown,
  idempotencyKey: string,
  authToken: string,
): Request {
  return new Request("http://test.local/api/v1/campaigns", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!E2E_ENABLED)("Idempotency-Key header", () => {
  it("same key + same body returns identical body and creates only one row", async () => {
    if (!token) throw new Error("setup failed");
    const key = `idem-${randomId("k")}`;
    const body = {
      name: randomId("camp-idem"),
      type: "DISCOUNT" as const,
      currency: "USD",
    };

    const r1 = await rawRequest(buildRequest(body, key, token));
    const r2 = await rawRequest(buildRequest(body, key, token));
    expect(r1.status).toBe(r2.status);
    const j1 = (await r1.json()) as { id: string };
    const j2 = (await r2.json()) as { id: string };
    expect(j1.id).toBe(j2.id);
  });

  it("same key + different body returns 409 conflict", async () => {
    if (!token) throw new Error("setup failed");
    const key = `idem-conflict-${randomId("k")}`;

    const first = await rawRequest(
      buildRequest(
        { name: randomId("camp-a"), type: "DISCOUNT" as const, currency: "USD" },
        key,
        token,
      ),
    );
    expect(first.status).toBeLessThan(400);

    const conflict = await rawRequest(
      buildRequest(
        { name: randomId("camp-b"), type: "DISCOUNT" as const, currency: "USD" },
        key,
        token,
      ),
    );
    expect(conflict.status).toBe(409);
  });
});
