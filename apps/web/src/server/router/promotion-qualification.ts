import { evaluateRule, type Rule, type RuleContext } from "@offerkit/core/rules";

export type PromotionRuleSkipReason = "rule_error" | "rule_failed";

export interface PromotionRuleEvaluationFailure {
  reason: PromotionRuleSkipReason;
  message: string;
}

export interface PromotionValidationRule {
  rule: Record<string, unknown>;
  deletedAt: Date | null;
}

export function evaluatePromotionRule(
  rule: PromotionValidationRule | undefined,
  context: RuleContext,
): PromotionRuleEvaluationFailure | null {
  if (!rule || rule.deletedAt) {
    return {
      reason: "rule_error",
      message: "Promotion validation rule is unavailable",
    };
  }

  const result = evaluateRule(rule.rule as Rule, context);
  if (result.trace.error) {
    return { reason: "rule_error", message: result.trace.error };
  }
  if (!result.passed) {
    return {
      reason: "rule_failed",
      message: "Promotion validation rule did not match",
    };
  }
  return null;
}
