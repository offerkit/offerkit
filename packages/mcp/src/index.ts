#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, type Client } from "@open-voucherify/sdk";

const baseUrl = process.env["OVX_API_URL"] ?? "http://localhost:3000";
const apiKey = process.env["OVX_API_KEY"];
if (!apiKey) {
  process.stderr.write(
    "OVX_API_KEY is required. Mint one in the dashboard at /settings/api-keys.\n",
  );
  process.exit(2);
}

const ovx: Client = createClient({ baseUrl, apiKey });

function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const server = new McpServer(
  { name: "open-voucherify", version: "0.0.0" },
  {
    instructions:
      "Tools to manage promotions: validate/redeem vouchers, list customers and " +
      "campaigns, query loyalty members. Mutating tools (redeem, stack-redeem) " +
      "should be confirmed with the user before invocation.",
  },
);

server.registerTool(
  "vouchers_list",
  {
    title: "List vouchers",
    description: "List vouchers, optionally filtered by code, campaign, or customer.",
    inputSchema: {
      search: z.string().optional(),
      campaignId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async (args) => jsonContent(await ovx.vouchers.list(args)),
);

server.registerTool(
  "vouchers_get",
  {
    title: "Get voucher by code",
    description: "Look up a single voucher.",
    inputSchema: { code: z.string() },
  },
  async ({ code }) => jsonContent(await ovx.vouchers.get({ code })),
);

server.registerTool(
  "vouchers_validate",
  {
    title: "Validate a voucher (read-only preview)",
    description: "Preview the discount a voucher would apply to a given order amount.",
    inputSchema: {
      code: z.string(),
      orderAmount: z.number().int().min(0),
      currency: z.string().length(3).default("USD"),
      customerId: z.string().uuid().optional(),
    },
  },
  async ({ code, orderAmount, currency, customerId }) =>
    jsonContent(
      await ovx.vouchers.validate({
        code,
        ...(customerId ? { customerId } : {}),
        order: { amount: orderAmount, currency, items: [] },
      }),
    ),
);

server.registerTool(
  "vouchers_redeem",
  {
    title: "Redeem a voucher (mutating)",
    description:
      "Commit a redemption against an order. Confirm with the user before calling. " +
      "Use idempotencyKey to safely retry.",
    inputSchema: {
      code: z.string(),
      orderAmount: z.number().int().min(0),
      currency: z.string().length(3).default("USD"),
      customerId: z.string().uuid().optional(),
      idempotencyKey: z.string().min(1).max(128).optional(),
    },
  },
  async ({ code, orderAmount, currency, customerId, idempotencyKey }) =>
    jsonContent(
      await ovx.vouchers.redeem({
        code,
        ...(customerId ? { customerId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        order: { amount: orderAmount, currency, items: [] },
      }),
    ),
);

server.registerTool(
  "vouchers_stack_redeem",
  {
    title: "Redeem multiple vouchers in one batch (mutating)",
    description:
      "Apply N codes to one order atomically. Either every voucher commits or none. " +
      "Confirm with the user before calling.",
    inputSchema: {
      codes: z.array(z.string()).min(1).max(20),
      orderAmount: z.number().int().min(0),
      currency: z.string().length(3).default("USD"),
      customerId: z.string().uuid().optional(),
      idempotencyKey: z.string().min(1).max(128).optional(),
    },
  },
  async ({ codes, orderAmount, currency, customerId, idempotencyKey }) =>
    jsonContent(
      await ovx.vouchers.stackRedeem({
        codes,
        ...(customerId ? { customerId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        order: { amount: orderAmount, currency, items: [] },
      }),
    ),
);

server.registerTool(
  "campaigns_list",
  {
    title: "List campaigns",
    description: "List campaigns of any type.",
    inputSchema: {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async (args) => jsonContent(await ovx.campaigns.list(args)),
);

server.registerTool(
  "campaigns_get",
  {
    title: "Get a campaign",
    inputSchema: { id: z.string().uuid() },
  },
  async ({ id }) => jsonContent(await ovx.campaigns.get({ id })),
);

server.registerTool(
  "customers_list",
  {
    title: "List customers",
    inputSchema: {
      search: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async (args) => jsonContent(await ovx.customers.list(args)),
);

server.registerTool(
  "customers_get",
  {
    title: "Get a customer",
    inputSchema: { id: z.string().uuid() },
  },
  async ({ id }) => jsonContent(await ovx.customers.get({ id })),
);

server.registerTool(
  "loyalty_member_history",
  {
    title: "Loyalty member transaction history",
    description: "List a member's loyalty ledger entries (earn / redeem / adjust / expiry).",
    inputSchema: { memberId: z.string().uuid() },
  },
  async ({ memberId }) => jsonContent(await ovx.loyalty.members.history({ id: memberId })),
);

server.registerTool(
  "segments_preview",
  {
    title: "Preview a segment rule against existing customers",
    description:
      "Run a JSON Logic rule against the customer table and report match count + a sample.",
    inputSchema: {
      rule: z.record(z.string(), z.unknown()),
      sampleSize: z.number().int().min(0).max(50).default(10),
    },
  },
  async ({ rule, sampleSize }) =>
    jsonContent(await ovx.segments.preview({ rule, sampleSize })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`ovx-mcp: connected to ${baseUrl}\n`);
