export interface TrustedRequestUser {
  id: string;
  email: string;
  role: "admin" | "member";
  actorKind: "user" | "api_key";
  scopes: readonly string[];
  rateLimitRps: number | null;
}

export interface RequestContext {
  request: Request;
  headers: Headers;
  /** Pre-authenticated identity supplied only by an in-process transport such as hosted MCP. */
  trustedUser?: TrustedRequestUser;
}
