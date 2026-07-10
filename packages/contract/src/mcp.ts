import { isContractProcedure, type AnyContractRouter } from "@orpc/contract";

// Declarative operation and MCP-exposure metadata. Attach via
// `.meta(mcpMeta({...}))` on a contract procedure to override how it appears
// in the @offerkit/mcp server. Untagged procedures use the default route-method
// policy below. The same operation risk drives MCP hints, auditing, and
// idempotency so those consumers cannot drift into separate verb allowlists.

export type OperationRiskLevel = "safe" | "mutating" | "destructive";
export type McpRiskLevel = OperationRiskLevel;

export interface OperationMeta {
  riskLevel: OperationRiskLevel;
}

export interface McpExposure {
  expose: true;
  /** Override for the MCP tool description. Falls back to procedure summary. */
  description?: string;
  /** Hint to the LLM host: `safe` is read-only, `mutating` writes state, `destructive` cannot be undone. */
  riskLevel: McpRiskLevel;
  /** Optional override for the MCP tool name. Defaults to the dotted procedure path with `_` separators. */
  name?: string;
}

export interface ProcedureMeta {
  operation?: OperationMeta;
  mcp?: McpExposure;
}

export interface ProcedureRouteMeta {
  method?: string;
  summary?: string;
}

export interface ProcedureDefinitionMeta {
  meta?: ProcedureMeta;
  route?: ProcedureRouteMeta;
}

/**
 * Returns a `meta` object that attaches MCP exposure to a procedure.
 * Wrapping in a helper keeps the call sites typed and uniform.
 */
export function mcpMeta(meta: McpExposure): ProcedureMeta {
  return { operation: { riskLevel: meta.riskLevel }, mcp: meta };
}

export function resolveOperationRisk(def: ProcedureDefinitionMeta): OperationRiskLevel {
  const explicit = def.meta?.operation?.riskLevel ?? def.meta?.mcp?.riskLevel;
  if (explicit) return explicit;
  const method = def.route?.method?.toUpperCase();
  if (method === "GET") return "safe";
  if (method === "DELETE") return "destructive";
  return "mutating";
}

export function resolveMcpExposure(def: ProcedureDefinitionMeta): McpExposure {
  const riskLevel = resolveOperationRisk(def);
  const explicit = def.meta?.mcp;
  if (explicit?.expose) return { ...explicit, riskLevel };
  return { expose: true, riskLevel };
}

/** Resolve the operation risk for a dotted oRPC path from the contract tree. */
export function resolveContractOperationRisk(
  router: AnyContractRouter,
  path: readonly string[],
): OperationRiskLevel | undefined {
  let node: AnyContractRouter | undefined = router;

  for (const segment of path) {
    if (!node || typeof node !== "object" || isContractProcedure(node)) return undefined;
    node = (node as Record<string, AnyContractRouter>)[segment];
  }

  if (!node || !isContractProcedure(node)) return undefined;
  const def = (node as { "~orpc": ProcedureDefinitionMeta })["~orpc"];
  return resolveOperationRisk(def);
}
