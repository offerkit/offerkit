import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "./index";

const SECRET = "whsec_test_secret_value";

function sign(body: string, secret: string, t: number): string {
  const v1 = createHmac("sha256", secret).update(`${String(t)}.${body}`).digest("hex");
  return `t=${String(t)},v1=${v1}`;
}

describe("verifyWebhook", () => {
  const body = JSON.stringify({ event: "voucher.redeemed", id: "123" });
  const now = Date.now();
  const t = Math.floor(now / 1000);

  it("accepts a fresh signature", () => {
    expect(verifyWebhook(body, sign(body, SECRET, t), SECRET, { now })).toBe(true);
  });

  it("rejects when the body is tampered", () => {
    const sig = sign(body, SECRET, t);
    expect(verifyWebhook(body + "x", sig, SECRET, { now })).toBe(false);
  });

  it("rejects when the secret is wrong", () => {
    const sig = sign(body, SECRET, t);
    expect(verifyWebhook(body, sig, "wrong-secret", { now })).toBe(false);
  });

  it("rejects when the signature is older than the tolerance window", () => {
    const stale = sign(body, SECRET, t - 600);
    expect(verifyWebhook(body, stale, SECRET, { now })).toBe(false);
  });

  it("rejects malformed signatures", () => {
    expect(verifyWebhook(body, "garbage", SECRET, { now })).toBe(false);
    expect(verifyWebhook(body, "t=abc,v1=zz", SECRET, { now })).toBe(false);
    expect(verifyWebhook(body, `t=${String(t)}`, SECRET, { now })).toBe(false);
  });

  it("rejects v1 hex of wrong length without throwing", () => {
    const sig = `t=${String(t)},v1=00`;
    expect(verifyWebhook(body, sig, SECRET, { now })).toBe(false);
  });
});
