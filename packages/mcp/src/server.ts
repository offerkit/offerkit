import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isContractProcedure, type AnyContractRouter } from "@orpc/contract";
import type { ZodRawShape } from "zod";
import {
  contract,
  resolveMcpExposure,
  type McpExposure,
  type ProcedureDefinitionMeta,
  type ProcedureMeta,
} from "@offerkit/contract";
import type { Client } from "@offerkit/sdk";
import { callBySdkPath } from "./sdk-path.ts";

export interface OfferKitMcpServerOptions {
  version?: string;
}

export interface OfferKitMcpServer {
  server: McpServer;
  toolNames: readonly string[];
}

interface DiscoveredProc {
  path: readonly string[];
  inputShape: ZodRawShape | undefined;
  exposure: McpExposure;
  summary: string | undefined;
}

/** Walk the contract tree and yield every API procedure. */
function* discover(node: AnyContractRouter, path: string[] = []): Generator<DiscoveredProc> {
  if (isContractProcedure(node)) {
    const def = (node as {
      "~orpc": {
        meta?: ProcedureMeta;
        inputSchema?: unknown;
        route?: { method?: string; summary?: string };
      };
    })["~orpc"];
    const exposure = resolveMcpExposure(def satisfies ProcedureDefinitionMeta);
    yield {
      path,
      inputShape: extractShape(def.inputSchema),
      exposure,
      summary: def.route?.summary,
    };
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, child] of Object.entries(node as Record<string, AnyContractRouter>)) {
    yield* discover(child, [...path, key]);
  }
}

/**
 * MCP's registerTool wants a `ZodRawShape` (field map), not a ZodObject.
 * Procedures in the contract use `z.object({...})` for inputs. The shape
 * lives on `.shape`. For non-ZodObject inputs (rare), fall back to `undefined`
 * so MCP treats the tool as no-arg.
 */
function extractShape(input: unknown): ZodRawShape | undefined {
  if (!input || typeof input !== "object") return undefined;
  const candidate = (input as { shape?: unknown }).shape;
  if (candidate && typeof candidate === "object") {
    return candidate as ZodRawShape;
  }
  return undefined;
}

const RISK_HINT: Record<McpExposure["riskLevel"], string> = {
  safe: "Read-only.",
  mutating: "Mutating — confirm with the user before calling. Use idempotencyKey to safely retry.",
  destructive: "Destructive — cannot be undone. Confirm with the user.",
};

function description(d: DiscoveredProc): string {
  const base = d.exposure.description ?? d.summary ?? d.path.join(".");
  return `${base} (${d.exposure.riskLevel}) ${RISK_HINT[d.exposure.riskLevel]}`;
}

/** Create a transport-agnostic MCP server backed by an OfferKit client. */
export function createOfferKitMcpServer(
  offerkit: Client,
  options: OfferKitMcpServerOptions = {},
): OfferKitMcpServer {
  const server = new McpServer(
    { name: "offerkit", version: options.version ?? "0.0.0" },
    {
      instructions:
        "Tools for managing promotions through Offerkit. Each tool's risk level " +
        "(`safe`, `mutating`, `destructive`) is in its description — confirm with the " +
        "user before invoking anything mutating or destructive.",
    },
  );

  const toolNames: string[] = [];
  for (const proc of discover(contract)) {
    if (!proc.exposure.expose) continue;
    const toolName = proc.exposure.name ?? proc.path.join("_");
    toolNames.push(toolName);
    server.registerTool(
      toolName,
      {
        title: proc.summary ?? proc.path.join("."),
        description: description(proc),
        ...(proc.inputShape ? { inputSchema: proc.inputShape } : {}),
        annotations: {
          readOnlyHint: proc.exposure.riskLevel === "safe",
          destructiveHint: proc.exposure.riskLevel === "destructive",
          idempotentHint: proc.exposure.riskLevel === "safe",
        },
      },
      async (args: unknown) => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(await callBySdkPath(offerkit, proc.path, args ?? {}), null, 2),
          },
        ],
      }),
    );
  }

  return { server, toolNames };
}
