#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { createClient, type Client } from "@offerkit/sdk";
import { createOfferKitMcpServer } from "./server.ts";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: unknown };
const packageVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

const baseUrl = process.env["OFFERKIT_API_URL"] ?? "http://localhost:3000";
const apiKey = process.env["OFFERKIT_API_KEY"];
if (!apiKey) {
  process.stderr.write(
    "OFFERKIT_API_KEY is required. Mint one in the dashboard at /settings/api-keys.\n",
  );
  process.exit(2);
}

const offerkit: Client = createClient({ baseUrl, apiKey });
const { server, toolNames } = createOfferKitMcpServer(offerkit, { version: packageVersion });

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(
  `offerkit-mcp: connected to ${baseUrl} with ${String(toolNames.length)} tools (${toolNames.join(", ")})\n`,
);
