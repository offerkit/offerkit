// Declarative MCP-exposure metadata. Attach via `.meta(mcpMeta({...}))`
// on a contract procedure to override how it appears in the @offerkit/mcp
// server. Untagged procedures use the default route-method policy below,
// keeping the exposure decision at the contract seam rather than in the
// MCP adapter.

export type McpRiskLevel = "safe" | "mutating" | "destructive";

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
  return { mcp: meta };
}

export function resolveMcpExposure(def: ProcedureDefinitionMeta): McpExposure {
  const explicit = def.meta?.mcp;
  if (explicit?.expose) return explicit;

  const method = def.route?.method?.toUpperCase();
  if (method === "GET") return { expose: true, riskLevel: "safe" };
  if (method === "DELETE") return { expose: true, riskLevel: "destructive" };
  return { expose: true, riskLevel: "mutating" };
}
