function isIndexable(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

/**
 * Reach into the typed SDK client by procedure path and invoke it. The
 * `unknown`-everywhere shape is unavoidable for dynamic indexing — the
 * type safety is provided by the contract's zod input schema, validated
 * by oRPC at call time.
 */
export async function callBySdkPath(
  client: unknown,
  path: readonly string[],
  args: unknown,
): Promise<unknown> {
  let node: unknown = client;
  for (const seg of path) {
    if (!isIndexable(node)) {
      throw new Error(`MCP tool path ${path.join(".")} not reachable on SDK client`);
    }
    node = node[seg];
  }
  if (typeof node !== "function") {
    throw new Error(`MCP tool path ${path.join(".")} did not resolve to a callable`);
  }
  return (node as (input: unknown) => Promise<unknown>)(args);
}
