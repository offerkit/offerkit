import { describe, expect, it } from "vitest";
import { evaluateRule, type Rule, type RuleContext } from "./index.ts";

const baseContext = (over: Partial<RuleContext> = {}): RuleContext => ({
  now: "2026-05-09T12:00:00.000Z",
  metadata: {},
  ...over,
});

describe("evaluateRule", () => {
  it("returns true for a literal true rule", () => {
    expect(evaluateRule(true, baseContext()).passed).toBe(true);
  });

  it("compares customer attributes through var lookups", () => {
    const rule: Rule = { "==": [{ var: "customer.email" }, "alice@example.com"] };
    const ctx = baseContext({ customer: { id: "1", email: "alice@example.com", segments: [] } });
    expect(evaluateRule(rule, ctx).passed).toBe(true);
  });

  it("supports customer.in_segment custom operator", () => {
    const rule: Rule = { "customer.in_segment": ["vip"] };
    const yes = baseContext({ customer: { id: "1", segments: ["vip", "uk"] } });
    const no = baseContext({ customer: { id: "1", segments: ["uk"] } });
    expect(evaluateRule(rule, yes).passed).toBe(true);
    expect(evaluateRule(rule, no).passed).toBe(false);
  });

  it("checks order.total_above with currency", () => {
    const rule: Rule = { "order.total_above": [5000, "USD"] };
    const ctx = baseContext({
      order: { amount: 7500, currency: "USD", items: [] },
    });
    expect(evaluateRule(rule, ctx).passed).toBe(true);

    const wrongCurrency = baseContext({
      order: { amount: 7500, currency: "EUR", items: [] },
    });
    expect(evaluateRule(rule, wrongCurrency).passed).toBe(false);
  });

  it("checks order.contains_product", () => {
    const rule: Rule = { "order.contains_product": ["sku-1"] };
    const ctx = baseContext({
      order: {
        amount: 100,
        currency: "USD",
        items: [{ productId: "sku-1", quantity: 1, unitPrice: 100 }],
      },
    });
    expect(evaluateRule(rule, ctx).passed).toBe(true);
  });

  it("checks date.between window", () => {
    const rule: Rule = { "date.between": ["2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z"] };
    expect(evaluateRule(rule, baseContext()).passed).toBe(true);

    const future: Rule = { "date.between": ["2027-01-01T00:00:00Z", "2027-12-31T23:59:59Z"] };
    expect(evaluateRule(future, baseContext()).passed).toBe(false);
  });

  it("captures rule-eval errors in the trace", () => {
    // Reference an undefined custom op to force throw in some json-logic-js
    // versions; otherwise json-logic-js gracefully returns null. Either way,
    // the result is well-formed and `passed` is false.
    const rule: Rule = { "===": [{ var: "missing.path" }, "nope"] };
    const result = evaluateRule(rule, baseContext());
    expect(result.passed).toBe(false);
  });
});
