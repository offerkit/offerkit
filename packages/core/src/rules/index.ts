import jsonLogic from "json-logic-js";

export type Rule = Record<string, unknown> | boolean | null | unknown[];

export interface RuleContext {
  customer?: {
    id: string;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    address?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
    segments?: string[];
    summary?: { totalSpent?: number; redemptionCount?: number; lastRedeemedAt?: string };
    loyalty?: { points?: number };
  };
  order?: {
    amount: number;
    currency: string;
    items: { productId: string; collectionId?: string; quantity: number; unitPrice: number }[];
  };
  voucher?: { id: string; code: string };
  redemptionsByCustomer?: number;
  now: string;
  metadata: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  passed: boolean;
  trace: {
    rule: Rule;
    context: RuleContext;
    error?: string;
  };
}

// Custom domain operators registered once per process. JSON Logic is sync, so
// any async fact (e.g. redemption count) must be pre-resolved into the context
// by the caller.
let registered = false;

function register() {
  if (registered) return;
  registered = true;

  jsonLogic.add_operation("customer.in_segment", (segmentId: string) => {
    const ctx = currentContext;
    return ctx?.customer?.segments?.includes(segmentId) === true;
  });

  jsonLogic.add_operation("order.contains_product", (productId: string) => {
    const ctx = currentContext;
    return ctx?.order?.items.some((i) => i.productId === productId) === true;
  });

  jsonLogic.add_operation("order.contains_collection", (collectionId: string) => {
    const ctx = currentContext;
    return ctx?.order?.items.some((i) => i.collectionId === collectionId) === true;
  });

  jsonLogic.add_operation("order.total_above", (amount: number, currency?: string) => {
    const ctx = currentContext;
    if (!ctx?.order) return false;
    if (currency && ctx.order.currency !== currency) return false;
    return ctx.order.amount > amount;
  });

  jsonLogic.add_operation("redemption.count_for_customer_above", (n: number) => {
    return (currentContext?.redemptionsByCustomer ?? 0) > n;
  });

  jsonLogic.add_operation("date.between", (startIso: string, endIso: string) => {
    const ctx = currentContext;
    if (!ctx) return false;
    const now = Date.parse(ctx.now);
    return now >= Date.parse(startIso) && now <= Date.parse(endIso);
  });
}

// Async-resolved facts live in the RuleContext directly; jsonLogic operates
// against the context object passed as the data argument, but our custom
// operators reach into a request-scoped context to access nested fields cleanly.
let currentContext: RuleContext | undefined;

export function evaluateRule(rule: Rule, context: RuleContext): RuleEvaluationResult {
  register();
  currentContext = context;
  try {
    const passed = Boolean(jsonLogic.apply(rule as Parameters<typeof jsonLogic.apply>[0], context));
    return { passed, trace: { rule, context } };
  } catch (err) {
    return {
      passed: false,
      trace: { rule, context, error: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    currentContext = undefined;
  }
}
