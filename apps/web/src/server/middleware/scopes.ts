const READ_ACTIONS = new Set([
  "list",
  "get",
  "events",
  "summary",
  "preview",
  "history",
  "balance",
  "deliveries",
]);

const REDEEM_ACTIONS = new Set(["redeem", "stackRedeem", "rollback", "validate"]);

export function requiredScopeFor(path: readonly string[]): string | null {
  const entity = path[0];
  const action = path[path.length - 1];
  if (!entity || !action || path.length < 2) return null;
  if (READ_ACTIONS.has(action)) return `${entity}:read`;
  if (REDEEM_ACTIONS.has(action)) return `${entity}:${action.toLowerCase()}`;
  return `${entity}:write`;
}

export function scopeAllows(grantedScopes: readonly string[], required: string): boolean {
  if (grantedScopes.includes("*")) return true;
  if (grantedScopes.includes(required)) return true;
  const colon = required.indexOf(":");
  if (colon === -1) return false;
  const entity = required.slice(0, colon);
  return grantedScopes.includes(`${entity}:*`);
}
