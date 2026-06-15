#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isContractProcedure, type AnyContractRouter } from "@orpc/contract";
import { z, type ZodRawShape } from "zod";
import { contract, type McpExposure, type ProcedureMeta } from "@offerkit/contract";
import { createClient, type Client } from "@offerkit/sdk";
import { callBySdkPath } from "./sdk-path.ts";

const baseUrl = process.env["OFFERKIT_API_URL"] ?? "http://localhost:3000";
const apiKey = process.env["OFFERKIT_API_KEY"];
if (!apiKey) {
  process.stderr.write(
    "OFFERKIT_API_KEY is required. Mint one in the dashboard at /settings/api-keys.\n",
  );
  process.exit(2);
}

const offerkit: Client = createClient({ baseUrl, apiKey });

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const server = new McpServer(
  { name: "offerkit", version: "0.0.0" },
  {
    instructions:
      "Tools for managing promotions through Offerkit. Each tool's risk level " +
      "(`safe`, `mutating`, `destructive`) is in its description — confirm with the " +
      "user before invoking anything mutating or destructive.",
  },
);

interface DiscoveredProc {
  path: readonly string[];
  inputShape: ZodRawShape | undefined;
  exposure: McpExposure;
  summary: string | undefined;
}

function exposureFor(def: {
  meta?: ProcedureMeta;
  route?: { method?: string; summary?: string };
}): McpExposure {
  const explicit = def.meta?.mcp;
  if (explicit?.expose) return explicit;

  const method = def.route?.method?.toUpperCase();
  if (method === "GET") return { expose: true, riskLevel: "safe" };
  if (method === "DELETE") return { expose: true, riskLevel: "destructive" };
  return { expose: true, riskLevel: "mutating" };
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
    yield {
      path,
      inputShape: extractShape(def.inputSchema),
      exposure: exposureFor(def),
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

const exposed: string[] = [];
for (const proc of discover(contract)) {
  const toolName = proc.exposure.name ?? proc.path.join("_");
  exposed.push(toolName);
  server.registerTool(
    toolName,
    {
      title: proc.summary ?? proc.path.join("."),
      description: description(proc),
      ...(proc.inputShape ? { inputSchema: proc.inputShape } : {}),
    },
    async (args: unknown) => jsonContent(await callBySdkPath(offerkit, proc.path, args ?? {})),
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `offerkit-mcp: connected to ${baseUrl} with ${String(exposed.length)} tools (${exposed.join(", ")})\n`,
);

// Suppress unused-var warning: z is required for the registerTool generic type
// inference even though we don't construct schemas directly here.
void z;
