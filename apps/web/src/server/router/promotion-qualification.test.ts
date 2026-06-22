import { describe, expect, it } from "vitest";
import { evaluatePromotionRule } from "./promotion-qualification";
import type { RuleContext } from "@offerkit/core/rules";

const context: RuleContext = {
  order: { amount: 1_000, currency: "USD", items: [] },
  now: "2026-06-22T00:00:00.000Z",
  metadata: {},
};

describe("evaluatePromotionRule", () => {
  it("treats deleted referenced rules as unavailable", () => {
    expect(
      evaluatePromotionRule(
        {
          rule: { "==": [1, 1] },
          deletedAt: new Date("2026-06-22T00:00:00.000Z"),
        },
        context,
      ),
    ).toEqual({
      reason: "rule_error",
      message: "Promotion validation rule is unavailable",
    });
  });

  it("returns rule_failed when an active rule does not match", () => {
    expect(
      evaluatePromotionRule(
        {
          rule: { ">=": [{ var: "order.amount" }, 2_000] },
          deletedAt: null,
        },
        context,
      ),
    ).toEqual({
      reason: "rule_failed",
      message: "Promotion validation rule did not match",
    });
  });

  it("returns null when an active rule matches", () => {
    expect(
      evaluatePromotionRule(
        {
          rule: { ">=": [{ var: "order.amount" }, 1_000] },
          deletedAt: null,
        },
        context,
      ),
    ).toBeNull();
  });
});
