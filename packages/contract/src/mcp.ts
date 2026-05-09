// Declarative MCP-exposure metadata. Attach via `.meta(mcpMeta({...}))`
// on a contract procedure to make it appear as a tool in the
// @open-voucherify/mcp server. Metadata is read at server boot — new
// procedures opt in (or stay hidden) by tagging this `mcp` field
// without touching the MCP package.

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

/**
 * Returns a `meta` object that attaches MCP exposure to a procedure.
 * Wrapping in a helper keeps the call sites typed and uniform.
 */
export function mcpMeta(meta: McpExposure): ProcedureMeta {
  return { mcp: meta };
}
