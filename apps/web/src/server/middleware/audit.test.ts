import { describe, expect, it } from "vitest";
import { ipFromHeaders, isMutationPath } from "./audit";

describe("isMutationPath", () => {
  it.each([
    ["campaigns.create", ["campaigns", "create"]],
    ["vouchers.redeem", ["vouchers", "redeem"]],
    ["vouchers.rollback", ["vouchers", "rollback"]],
    ["loyalty.earn", ["loyalty", "earn"]],
    ["users.disable", ["users", "disable"]],
  ])("%s is a mutation", (_label, path) => {
    expect(isMutationPath(path)).toBe(true);
  });

  it.each([
    ["campaigns.list", ["campaigns", "list"]],
    ["customers.get", ["customers", "get"]],
    ["insights.summary", ["insights", "summary"]],
    ["health", ["health"]],
    ["empty", []],
  ])("%s is not a mutation", (_label, path) => {
    expect(isMutationPath(path)).toBe(false);
  });
});

describe("ipFromHeaders", () => {
  it("returns the first hop in x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" });
    expect(ipFromHeaders(h)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.7" });
    expect(ipFromHeaders(h)).toBe("203.0.113.7");
  });

  it("returns null when neither header is present", () => {
    expect(ipFromHeaders(new Headers())).toBeNull();
  });
});
