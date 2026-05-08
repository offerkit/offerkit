import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  apiKeyCreateInput,
  apiKeyCreateOutput,
  apiKeyOutput,
} from "../schemas/api-key.ts";

export const apiKeys = {
  list: oc
    .route({ method: "GET", path: "/api-keys", summary: "List API keys" })
    .output(z.object({ data: z.array(apiKeyOutput) })),
  create: oc
    .route({ method: "POST", path: "/api-keys", summary: "Mint a new API key" })
    .input(apiKeyCreateInput)
    .output(apiKeyCreateOutput),
  revoke: oc
    .route({
      method: "DELETE",
      path: "/api-keys/{id}",
      summary: "Disable an API key (cannot be re-enabled)",
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ ok: z.literal(true) })),
};
