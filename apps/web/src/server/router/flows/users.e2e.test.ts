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

describe.skipIf(!E2E_ENABLED)("staff users admin", () => {
  it("create staff user → list → reset password → disable", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const email = `${randomId("staff")}@example.com`;
    const created = await client.users.create({ email, role: "member" });
    expect(created.email).toBe(email);
    expect(created.role).toBe("member");
    expect(created.password).toBeTruthy();
    expect(created.mustChangePassword).toBe(true);

    const list = await client.users.list({});
    expect(list.data.find((u) => u.id === created.id)).toBeDefined();

    const reset = await client.users.resetPassword({ params: { id: created.id } });
    expect(reset.password).toBeTruthy();
    expect(reset.password).not.toBe(created.password);

    const disabled = await client.users.disable({ params: { id: created.id } });
    expect(disabled.disabledAt).not.toBeNull();

    const reEnabled = await client.users.enable({ params: { id: created.id } });
    expect(reEnabled.disabledAt).toBeNull();
  });
});
