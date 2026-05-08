import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { contract, type Contract } from "@open-voucherify/contract";

export interface SdkOptions {
  /** Base URL of the open-voucherify deployment, e.g. https://ovx.example.com */
  baseUrl: string;
  /** API key for programmatic access. Optional for browser callers using cookie auth. */
  apiKey?: string;
  /** Custom fetch implementation (e.g. node-fetch, undici, edge runtime). */
  fetch?: typeof fetch;
}

export type Client = ContractRouterClient<Contract>;

export function createClient(options: SdkOptions): Client {
  const link = new OpenAPILink(contract, {
    url: `${options.baseUrl.replace(/\/$/, "")}/api/v1`,
    headers: () => {
      const headers: Record<string, string> = {};
      if (options.apiKey) headers["Authorization"] = `Bearer ${options.apiKey}`;
      return headers;
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return createORPCClient(link) satisfies Client;
}
