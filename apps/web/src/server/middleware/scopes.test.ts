import { describe, expect, it } from "vitest";
import { requiredScopeFor, scopeAllows } from "./scopes";

describe("requiredScopeFor", () => {
  it("read actions resolve to <entity>:read", () => {
    expect(requiredScopeFor(["vouchers", "list"])).toBe("vouchers:read");
    expect(requiredScopeFor(["customers", "get"])).toBe("customers:read");
    expect(requiredScopeFor(["loyalty", "balance"])).toBe("loyalty:read");
  });

  it("redeem-family actions resolve to <entity>:<action>", () => {
    expect(requiredScopeFor(["vouchers", "redeem"])).toBe("vouchers:redeem");
    expect(requiredScopeFor(["vouchers", "validate"])).toBe("vouchers:validate");
    expect(requiredScopeFor(["vouchers", "rollback"])).toBe("vouchers:rollback");
  });

  it("everything else resolves to <entity>:write", () => {
    expect(requiredScopeFor(["campaigns", "create"])).toBe("campaigns:write");
    expect(requiredScopeFor(["webhooks", "delete"])).toBe("webhooks:write");
    expect(requiredScopeFor(["users", "disable"])).toBe("users:write");
  });

  it("returns null for unscoped paths", () => {
    expect(requiredScopeFor([])).toBeNull();
    expect(requiredScopeFor(["health"])).toBeNull();
  });
});

describe("scopeAllows", () => {
  it("wildcard `*` matches everything", () => {
    expect(scopeAllows(["*"], "vouchers:redeem")).toBe(true);
    expect(scopeAllows(["*"], "campaigns:write")).toBe(true);
  });

  it("entity-wildcard matches scopes under that entity", () => {
    expect(scopeAllows(["vouchers:*"], "vouchers:redeem")).toBe(true);
    expect(scopeAllows(["vouchers:*"], "vouchers:write")).toBe(true);
    expect(scopeAllows(["vouchers:*"], "campaigns:read")).toBe(false);
  });

  it("exact-match required", () => {
    expect(scopeAllows(["vouchers:redeem"], "vouchers:redeem")).toBe(true);
    expect(scopeAllows(["vouchers:read"], "vouchers:redeem")).toBe(false);
  });

  it("empty scopes never grant", () => {
    expect(scopeAllows([], "vouchers:redeem")).toBe(false);
  });
});
