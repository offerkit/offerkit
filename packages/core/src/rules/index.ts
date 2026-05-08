// Validation rules engine — JSON Logic with custom domain operators.
// Phase 3 implementation lands here.
export interface RuleContext {
  customer?: { id: string; segments: string[]; loyalty?: { points: number } };
  order?: { amount: number; items: unknown[]; currency: string };
  voucher?: { id: string; code: string };
  now: string;
  metadata: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  passed: boolean;
  trace: { rule: unknown; context: RuleContext; failedAt?: string };
}

export function evaluateRule(_rule: unknown, _context: RuleContext): RuleEvaluationResult {
  throw new Error("not implemented (Phase 3)");
}
