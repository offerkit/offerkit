#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, chmod, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { createClient, type Client } from "@offerkit/sdk";

interface Config {
  baseUrl: string;
  apiKey?: string;
}

function rcPath(): string {
  return join(homedir(), ".offerkitrc");
}

export async function loadConfig(): Promise<Config> {
  let cfg: Config = { baseUrl: "http://localhost:3000" };
  try {
    const raw = await readFile(rcPath(), "utf8");
    const fromFile = JSON.parse(raw) as Config;
    cfg = { ...cfg, ...fromFile };
  } catch {
    // Missing or unreadable config files fall back to explicit env or localhost.
  }
  if (process.env["OFFERKIT_API_URL"]) cfg.baseUrl = process.env["OFFERKIT_API_URL"];
  if (process.env["OFFERKIT_API_KEY"]) cfg.apiKey = process.env["OFFERKIT_API_KEY"];
  return cfg;
}

export async function saveConfig(cfg: Config): Promise<void> {
  await mkdir(homedir(), { recursive: true });
  await writeFile(rcPath(), JSON.stringify(cfg, null, 2), "utf8");
  await chmod(rcPath(), 0o600);
}

async function client(): Promise<Client> {
  const cfg = await loadConfig();
  if (!cfg.apiKey) {
    process.stderr.write(
      "No API key configured. Run `offerkit login` or set OFFERKIT_API_KEY.\n",
    );
    process.exit(2);
  }
  return createClient({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
}

function printJSON(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function parseJsonInput(raw: string | undefined): Promise<unknown> {
  if (raw === undefined) return undefined;

  let text = raw;
  if (raw === "-") {
    text = await readStdin();
  } else if (raw.startsWith("@")) {
    text = await readFile(raw.slice(1), "utf8");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON input: ${detail}`);
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function parseJsonObject(raw: string | undefined, fallback: JsonRecord = {}): Promise<JsonRecord> {
  const parsed = await parseJsonInput(raw);
  if (parsed === undefined) return fallback;
  if (!isRecord(parsed)) throw new Error("JSON input must be an object");
  return parsed;
}

async function parseOptionalJsonObject(raw: string | undefined): Promise<JsonRecord | undefined> {
  if (raw === undefined) return undefined;
  return parseJsonObject(raw);
}

function assignDefined(target: JsonRecord, values: JsonRecord): JsonRecord {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) target[key] = value;
  }
  return target;
}

function isIndexable(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function intOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected integer, got ${value}`);
  return parsed;
}

function addJsonDataOption(command: Command): Command {
  return command.option("--data <json>", "JSON data, @file.json, or - to read JSON from stdin");
}

function addListOptions(command: Command, includeSearch = true): Command {
  command.option("--limit <n>", "Page size", "20");
  command.option("--cursor <cursor>", "Pagination cursor");
  if (includeSearch) command.option("--search <query>", "Search query");
  return command;
}

async function listInput(opts: {
  limit?: string;
  cursor?: string;
  search?: string;
  [key: string]: unknown;
}): Promise<JsonRecord> {
  const out: JsonRecord = {};
  if (opts.limit !== undefined) out["limit"] = Number(opts.limit);
  if (opts.cursor !== undefined) out["cursor"] = opts.cursor;
  if (opts.search !== undefined) out["search"] = opts.search;
  return out;
}

async function callAndPrint(path: string, input?: unknown): Promise<void> {
  const c = await client();
  printJSON(await callBySdkPath(c, path, input).catch(fail));
}

export async function callBySdkPath(
  c: Client,
  path: string,
  args: unknown,
): Promise<unknown> {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) throw new Error("API procedure path is required");

  let node: unknown = c;
  for (const part of parts) {
    if (!isIndexable(node)) {
      throw new Error(`API procedure ${path} is not reachable`);
    }
    node = node[part];
  }

  if (typeof node !== "function") {
    throw new Error(`API procedure ${path} did not resolve to a callable`);
  }

  return args === undefined
    ? (node as () => Promise<unknown>)()
    : (node as (input: unknown) => Promise<unknown>)(args);
}

function fail(err: unknown): never {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const program = new Command();
program.name("offerkit").description("OfferKit CLI").version("0.0.0");

program
  .command("login")
  .description("Save the API base URL + key to ~/.offerkitrc")
  .requiredOption("--url <url>", "Deployment base URL")
  .requiredOption("--api-key <key>", "API key (offerkit_<prefix>_<secret>)")
  .action(async (opts: { url: string; apiKey: string }) => {
    await saveConfig({ baseUrl: opts.url, apiKey: opts.apiKey });
    process.stdout.write(`Saved to ${rcPath()}\n`);
  });

program
  .command("api <path>")
  .description("Call any OfferKit API procedure by SDK path")
  .option(
    "--input <json>",
    "JSON input, @file.json, or - to read JSON from stdin",
  )
  .addHelpText(
    "after",
    `

Examples:
  offerkit api validationRules.create --input '{"name":"Min spend","appliesTo":"voucher","rule":{">=":[{"var":"order.amount"},25000]}}'
  offerkit api campaigns.create --input '{"name":"WAPP25","type":"DISCOUNT","currency":"EUR","validationRuleId":"..."}'
  offerkit api vouchers.create --input '{"code":"WAPP25","campaignId":"...","type":"DISCOUNT","discount":{"type":"AMOUNT","amount":2500}}'
  offerkit api vouchers.validate --input '{"params":{"code":"WAPP25"},"body":{"order":{"amount":25000,"currency":"EUR","items":[]}}}'
`,
  )
  .action(async (path: string, opts: { input?: string }) => {
    const c = await client();
    const input = await parseJsonInput(opts.input).catch(fail);
    printJSON(await callBySdkPath(c, path, input).catch(fail));
  });

function addSimpleCrudCommands(
  parent: Command,
  config: {
    name: string;
    path: string;
    idName?: string;
    listSearch?: boolean;
  },
): Command {
  const idName = config.idName ?? "id";
  const group = parent.command(config.name).description(`Manage ${config.name}`);

  addListOptions(group.command("list").description(`List ${config.name}`), config.listSearch ?? true)
    .action(async (opts: { limit?: string; cursor?: string; search?: string }) => {
      await callAndPrint(`${config.path}.list`, await listInput(opts));
    });

  group
    .command(`get <${idName}>`)
    .description(`Get one ${config.name}`)
    .action(async (id: string) => {
      await callAndPrint(`${config.path}.get`, { params: { [idName]: id } });
    });

  addJsonDataOption(group.command("create").description(`Create ${config.name}`))
    .action(async (opts: { data?: string }) => {
      await callAndPrint(`${config.path}.create`, await parseJsonObject(opts.data).catch(fail));
    });

  addJsonDataOption(group.command(`update <${idName}>`).description(`Update ${config.name}`))
    .action(async (id: string, opts: { data?: string }) => {
      await callAndPrint(`${config.path}.update`, {
        params: { [idName]: id },
        body: { patch: await parseJsonObject(opts.data).catch(fail) },
      });
    });

  group
    .command(`delete <${idName}>`)
    .description(`Delete ${config.name}`)
    .action(async (id: string) => {
      await callAndPrint(`${config.path}.delete`, { params: { [idName]: id } });
    });

  return group;
}

const vouchers = program.command("vouchers").description("Manage vouchers");

vouchers
  .command("list")
  .description("List vouchers")
  .option("--limit <n>", "Page size", "20")
  .option("--search <query>", "Search by code")
  .action(async (opts: { limit: string; search?: string }) => {
    const c = await client();
    const out = await c.vouchers
      .list({
        limit: Number(opts.limit),
        ...(opts.search ? { search: opts.search } : {}),
      })
      .catch(fail);
    printJSON(out);
  });

vouchers
  .command("get <code>")
  .description("Show one voucher by code")
  .action(async (code: string) => {
    const c = await client();
    printJSON(await c.vouchers.get({ params: { code } }).catch(fail));
  });

addJsonDataOption(
  vouchers
    .command("create")
    .description("Create a voucher")
    .option("--code <code>", "Voucher code")
    .option("--campaign-id <id>", "Campaign id")
    .option("--type <type>", "DISCOUNT | GIFT_CARD", "DISCOUNT")
    .option("--discount-amount <cents>", "Fixed discount in cents", intOption)
    .option("--discount-percent <bps>", "Percentage discount in basis points", intOption)
    .option("--max-discount-amount <cents>", "Max percentage discount cap in cents", intOption)
    .option("--gift-balance <cents>", "Gift card starting balance in cents", intOption)
    .option("--redemption-limit <n>", "Redemption limit", intOption)
    .option("--per-user-redemption-limit <n>", "Per-user redemption limit", intOption)
    .option("--customer-id <id>", "Customer id")
    .option("--priority <n>", "Priority", intOption)
    .option("--exclusive", "Prevent stacking")
    .option("--start-date <iso>", "Start date ISO string")
    .option("--end-date <iso>", "End date ISO string")
    .option("--metadata <json>", "Metadata JSON object"),
).action(
  async (opts: {
    data?: string;
    code?: string;
    campaignId?: string;
    type: string;
    discountAmount?: number;
    discountPercent?: number;
    maxDiscountAmount?: number;
    giftBalance?: number;
    redemptionLimit?: number;
    perUserRedemptionLimit?: number;
    customerId?: string;
    priority?: number;
    exclusive?: boolean;
    startDate?: string;
    endDate?: string;
    metadata?: string;
  }) => {
    const data = await parseJsonObject(opts.data).catch(fail);
    const metadata = await parseOptionalJsonObject(opts.metadata).catch(fail);
    const discount =
      opts.discountAmount !== undefined
        ? {
            type: "AMOUNT",
            amount: opts.discountAmount,
            ...(opts.maxDiscountAmount !== undefined
              ? { maxDiscountAmount: opts.maxDiscountAmount }
              : {}),
          }
        : opts.discountPercent !== undefined
          ? {
              type: "PERCENTAGE",
              percent: opts.discountPercent,
              ...(opts.maxDiscountAmount !== undefined
                ? { maxDiscountAmount: opts.maxDiscountAmount }
                : {}),
            }
          : undefined;

    await callAndPrint(
      "vouchers.create",
      assignDefined(data, {
        code: opts.code,
        campaignId: opts.campaignId,
        type: opts.type,
        discount,
        giftBalance: opts.giftBalance,
        redemptionLimit: opts.redemptionLimit,
        perUserRedemptionLimit: opts.perUserRedemptionLimit,
        customerId: opts.customerId,
        priority: opts.priority,
        exclusive: opts.exclusive,
        startDate: opts.startDate,
        endDate: opts.endDate,
        metadata,
      }),
    );
  },
);

addJsonDataOption(vouchers.command("update <code>").description("Update a voucher"))
  .action(async (code: string, opts: { data?: string }) => {
    await callAndPrint("vouchers.update", {
      params: { code },
      body: { patch: await parseJsonObject(opts.data).catch(fail) },
    });
  });

vouchers
  .command("delete <code>")
  .description("Delete a voucher")
  .action(async (code: string) => {
    await callAndPrint("vouchers.delete", { params: { code } });
  });

addJsonDataOption(
  vouchers
    .command("bulk")
    .description("Generate vouchers in bulk")
    .option("--campaign-id <id>", "Campaign id")
    .option("--count <n>", "Number of codes to generate", intOption)
    .option("--discount-amount <cents>", "Fixed discount in cents", intOption)
    .option("--gift-balance <cents>", "Gift card starting balance in cents", intOption),
).action(
  async (opts: {
    data?: string;
    campaignId?: string;
    count?: number;
    discountAmount?: number;
    giftBalance?: number;
  }) => {
    const data = await parseJsonObject(opts.data).catch(fail);
    await callAndPrint(
      "vouchers.bulk",
      assignDefined(data, {
        campaignId: opts.campaignId,
        count: opts.count,
        discount:
          opts.discountAmount === undefined
            ? undefined
            : { type: "AMOUNT", amount: opts.discountAmount },
        giftBalance: opts.giftBalance,
      }),
    );
  },
);

vouchers
  .command("validate <code>")
  .description("Validate a voucher against an order")
  .option("--amount <cents>", "Order amount in cents")
  .option("--currency <iso>", "Currency", "USD")
  .option("--customer-id <id>", "Internal OfferKit customer id")
  .option("--customer-external-id <id>", "Integrator customer id")
  .option("--data <json>", "Validation body JSON, @file.json, or - from stdin")
  .action(async (code: string, opts: {
    amount: string;
    currency: string;
    customerId?: string;
    customerExternalId?: string;
    data?: string;
  }) => {
    const c = await client();
    if (!opts.data && opts.amount === undefined) {
      fail("Either --amount or --data is required");
    }
    const body = opts.data
      ? await parseJsonObject(opts.data).catch(fail)
      : {
          ...(opts.customerId ? { customerId: opts.customerId } : {}),
          ...(opts.customerExternalId ? { customerExternalId: opts.customerExternalId } : {}),
          order: { amount: Number(opts.amount), currency: opts.currency, items: [] },
        };
    printJSON(
      await c.vouchers
        .validate({
          params: { code },
          body,
        })
        .catch(fail),
    );
  });

vouchers
  .command("redeem <code>")
  .description("Redeem a voucher against an order")
  .option("--amount <cents>", "Order amount in cents")
  .option("--currency <iso>", "Currency", "USD")
  .option("--customer-id <id>", "Internal OfferKit customer id")
  .option("--customer-external-id <id>", "Integrator customer id")
  .option("--idempotency-key <key>", "Replay an existing redemption")
  .option("--data <json>", "Redemption body JSON, @file.json, or - from stdin")
  .action(
    async (
      code: string,
      opts: {
        amount: string;
        currency: string;
        customerId?: string;
        customerExternalId?: string;
        idempotencyKey?: string;
        data?: string;
      },
    ) => {
      const c = await client();
      if (!opts.data && opts.amount === undefined) {
        fail("Either --amount or --data is required");
      }
      const body = opts.data
        ? await parseJsonObject(opts.data).catch(fail)
        : {
            ...(opts.customerId ? { customerId: opts.customerId } : {}),
            ...(opts.customerExternalId ? { customerExternalId: opts.customerExternalId } : {}),
            order: { amount: Number(opts.amount), currency: opts.currency, items: [] },
            ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
          };
      printJSON(
        await c.vouchers
          .redeem({
            params: { code },
            body,
          })
          .catch(fail),
      );
    },
  );

addJsonDataOption(vouchers.command("qualify").description("Batch-qualify vouchers"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("vouchers.qualify", await parseJsonObject(opts.data).catch(fail));
  });

addJsonDataOption(vouchers.command("stack-redeem").description("Redeem multiple vouchers atomically"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("vouchers.stackRedeem", await parseJsonObject(opts.data).catch(fail));
  });

vouchers
  .command("transactions <code>")
  .description("List gift card transactions for a voucher")
  .action(async (code: string) => {
    await callAndPrint("vouchers.transactions", { params: { code } });
  });

const campaigns = program.command("campaigns").description("Manage campaigns");

campaigns
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .action(async (opts: { limit: string }) => {
    const c = await client();
    printJSON(await c.campaigns.list({ limit: Number(opts.limit) }).catch(fail));
  });

campaigns
  .command("get <id>")
  .description("Show one campaign")
  .action(async (id: string) => {
    await callAndPrint("campaigns.get", { params: { id } });
  });

campaigns
  .command("create")
  .description("Create a campaign")
  .requiredOption("--name <name>", "Campaign name")
  .requiredOption(
    "--type <type>",
    "DISCOUNT | GIFT_VOUCHERS | LOYALTY_PROGRAM | REFERRAL_PROGRAM | PROMOTION",
  )
  .requiredOption("--currency <iso>", "ISO 4217 currency")
  .option("--description <text>", "Description")
  .option("--timezone <tz>", "Timezone")
  .option("--start-date <iso>", "Start date ISO string")
  .option("--end-date <iso>", "End date ISO string")
  .option("--validation-rule-id <id>", "Validation rule id")
  .option("--per-user-redemption-limit <n>", "Per-user redemption limit", intOption)
  .option("--auto-apply", "Auto-apply campaign")
  .option("--code-length <n>", "Generated code length", intOption)
  .option("--code-prefix <prefix>", "Generated code prefix")
  .option("--metadata <json>", "Metadata JSON object")
  .option("--data <json>", "Base campaign JSON, @file.json, or - from stdin")
  .action(
    async (opts: {
      name: string;
      type: string;
      currency: string;
      description?: string;
      timezone?: string;
      startDate?: string;
      endDate?: string;
      validationRuleId?: string;
      perUserRedemptionLimit?: number;
      autoApply?: boolean;
      codeLength?: number;
      codePrefix?: string;
      metadata?: string;
      data?: string;
    }) => {
      const data = await parseJsonObject(opts.data).catch(fail);
      const metadata = await parseOptionalJsonObject(opts.metadata).catch(fail);
      const codeConfig =
        opts.codeLength === undefined && opts.codePrefix === undefined
          ? undefined
          : assignDefined({}, { length: opts.codeLength, prefix: opts.codePrefix });
      await callAndPrint(
        "campaigns.create",
        assignDefined(data, {
          name: opts.name,
          type: opts.type,
          currency: opts.currency,
          description: opts.description,
          timezone: opts.timezone,
          startDate: opts.startDate,
          endDate: opts.endDate,
          validationRuleId: opts.validationRuleId,
          perUserRedemptionLimit: opts.perUserRedemptionLimit,
          autoApply: opts.autoApply,
          codeConfig,
          metadata,
        }),
      );
    },
  );

addJsonDataOption(
  campaigns
    .command("update <id>")
    .description("Update a campaign")
    .option("--status <status>", "draft | active | paused | ended")
    .option("--validation-rule-id <id>", "Validation rule id")
    .option("--per-user-redemption-limit <n>", "Per-user redemption limit", intOption)
    .option("--auto-apply <value>", "true | false"),
).action(
  async (
    id: string,
    opts: {
      data?: string;
      status?: string;
      validationRuleId?: string;
      perUserRedemptionLimit?: number;
      autoApply?: string;
    },
  ) => {
    const patch = await parseJsonObject(opts.data).catch(fail);
    await callAndPrint("campaigns.update", {
      params: { id },
      body: {
        patch: assignDefined(patch, {
          status: opts.status,
          validationRuleId: opts.validationRuleId,
          perUserRedemptionLimit: opts.perUserRedemptionLimit,
          autoApply:
            opts.autoApply === undefined ? undefined : opts.autoApply.toLowerCase() === "true",
        }),
      },
    });
  });

campaigns
  .command("delete <id>")
  .description("Delete a campaign")
  .action(async (id: string) => {
    await callAndPrint("campaigns.delete", { params: { id } });
  });

const validationRules = program
  .command("validation-rules")
  .alias("rules")
  .description("Manage validation rules");

addListOptions(validationRules.command("list").description("List validation rules"))
  .action(async (opts: { limit?: string; cursor?: string; search?: string }) => {
    await callAndPrint("validationRules.list", await listInput(opts));
  });

validationRules
  .command("get <id>")
  .description("Show one validation rule")
  .action(async (id: string) => {
    await callAndPrint("validationRules.get", { params: { id } });
  });

addJsonDataOption(
  validationRules
    .command("create")
    .description("Create a validation rule")
    .option("--name <name>", "Rule name")
    .option("--description <text>", "Description")
    .option("--applies-to <kind>", "voucher | promotion | earn | reward", "voucher")
    .option("--rule <json>", "JSON Logic rule object, @file.json, or - from stdin"),
).action(
  async (opts: {
    data?: string;
    name?: string;
    description?: string;
    appliesTo?: string;
    rule?: string;
  }) => {
    const data = await parseJsonObject(opts.data).catch(fail);
    const rule = await parseOptionalJsonObject(opts.rule).catch(fail);
    await callAndPrint(
      "validationRules.create",
      assignDefined(data, {
        name: opts.name,
        description: opts.description,
        appliesTo: opts.appliesTo,
        rule,
      }),
    );
  },
);

addJsonDataOption(validationRules.command("update <id>").description("Update a validation rule"))
  .action(async (id: string, opts: { data?: string }) => {
    await callAndPrint("validationRules.update", {
      params: { id },
      body: { patch: await parseJsonObject(opts.data).catch(fail) },
    });
  });

validationRules
  .command("delete <id>")
  .description("Delete a validation rule")
  .action(async (id: string) => {
    await callAndPrint("validationRules.delete", { params: { id } });
  });

const customers = program.command("customers").description("Manage customers");

customers
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .option("--search <query>", "Search by email or name")
  .action(async (opts: { limit: string; search?: string }) => {
    const c = await client();
    printJSON(
      await c.customers
        .list({
          limit: Number(opts.limit),
          ...(opts.search ? { search: opts.search } : {}),
        })
        .catch(fail),
    );
  });

customers.command("get <id>").action(async (id: string) => {
  const c = await client();
  printJSON(await c.customers.get({ params: { id } }).catch(fail));
});

customers.command("get-by-external-id <externalId>").action(async (externalId: string) => {
  await callAndPrint("customers.getByExternalId", { params: { externalId } });
});

addJsonDataOption(customers.command("create").description("Create customer"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("customers.create", await parseJsonObject(opts.data).catch(fail));
  });

addJsonDataOption(customers.command("upsert").description("Create or update customer by externalId"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("customers.upsert", await parseJsonObject(opts.data).catch(fail));
  });

addJsonDataOption(customers.command("update <id>").description("Update customer"))
  .action(async (id: string, opts: { data?: string }) => {
    await callAndPrint("customers.update", {
      params: { id },
      body: { patch: await parseJsonObject(opts.data).catch(fail) },
    });
  });

customers
  .command("delete <id>")
  .description("Delete customer")
  .action(async (id: string) => {
    await callAndPrint("customers.delete", { params: { id } });
  });

const segments = addSimpleCrudCommands(program, {
  name: "segments",
  path: "segments",
});
addJsonDataOption(segments.command("preview").description("Preview a segment rule"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("segments.preview", await parseJsonObject(opts.data).catch(fail));
  });

const promotions = program.command("promotions").description("Manage promotions");
addSimpleCrudCommands(promotions, {
  name: "tiers",
  path: "promotions.tiers",
});
addJsonDataOption(promotions.command("qualify").description("Qualify auto-applied promotions"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("promotions.qualify", await parseJsonObject(opts.data).catch(fail));
  });

addSimpleCrudCommands(program, {
  name: "reward-types",
  path: "rewardTypes",
});

const referrals = program.command("referrals").description("Manage referrals");
addSimpleCrudCommands(referrals, {
  name: "programs",
  path: "referrals.programs",
  listSearch: false,
});
referrals
  .command("get-by-code <code>")
  .description("Look up a referral code")
  .action(async (code: string) => {
    await callAndPrint("referrals.getByCode", { params: { code } });
  });
addJsonDataOption(referrals.command("issue").description("Issue or fetch a referral code"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("referrals.issue", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(referrals.command("convert").description("Convert a referral"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("referrals.convert", await parseJsonObject(opts.data).catch(fail));
  });
referrals
  .command("codes <programId>")
  .description("List referral codes in a program")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("referrals.listCodes", {
      params: { programId },
      query: await listInput(opts),
    });
  });
referrals
  .command("conversions <codeId>")
  .description("List conversions for a referral code")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (codeId: string, opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("referrals.listConversions", {
      params: { codeId },
      query: await listInput(opts),
    });
  });
referrals
  .command("program-conversions <programId>")
  .description("List conversions in a referral program")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("referrals.listProgramConversions", {
      params: { programId },
      query: await listInput(opts),
    });
  });

const loyalty = program.command("loyalty").description("Manage loyalty");
addSimpleCrudCommands(loyalty, {
  name: "programs",
  path: "loyalty.programs",
  listSearch: false,
});

function addProgramChildCommands(
  parent: Command,
  config: {
    name: string;
    path: string;
  },
): void {
  const group = parent.command(config.name).description(`Manage loyalty ${config.name}`);
  group
    .command("list <programId>")
    .description(`List loyalty ${config.name}`)
    .action(async (programId: string) => {
      await callAndPrint(`${config.path}.list`, { params: { programId } });
    });
  addJsonDataOption(group.command("create").description(`Create loyalty ${config.name}`))
    .action(async (opts: { data?: string }) => {
      await callAndPrint(`${config.path}.create`, await parseJsonObject(opts.data).catch(fail));
    });
  addJsonDataOption(group.command("update <id>").description(`Update loyalty ${config.name}`))
    .action(async (id: string, opts: { data?: string }) => {
      await callAndPrint(`${config.path}.update`, {
        params: { id },
        body: { patch: await parseJsonObject(opts.data).catch(fail) },
      });
    });
  group
    .command("delete <id>")
    .description(`Delete loyalty ${config.name}`)
    .action(async (id: string) => {
      await callAndPrint(`${config.path}.delete`, { params: { id } });
    });
}

addProgramChildCommands(loyalty, { name: "tiers", path: "loyalty.tiers" });
addProgramChildCommands(loyalty, {
  name: "earning-rules",
  path: "loyalty.earningRules",
});
addProgramChildCommands(loyalty, { name: "rewards", path: "loyalty.rewards" });

const loyaltyMembers = loyalty.command("members").description("Manage loyalty members");
loyaltyMembers
  .command("list <programId>")
  .description("List loyalty members")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("loyalty.members.list", {
      params: { programId },
      query: await listInput(opts),
    });
  });
loyaltyMembers
  .command("get <id>")
  .description("Get loyalty member")
  .action(async (id: string) => {
    await callAndPrint("loyalty.members.get", { params: { id } });
  });
addJsonDataOption(loyaltyMembers.command("enroll").description("Enroll customer"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("loyalty.members.enroll", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(loyaltyMembers.command("earn").description("Earn points"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("loyalty.members.earn", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(loyaltyMembers.command("adjust").description("Manual points adjustment"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("loyalty.members.adjust", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(loyaltyMembers.command("redeem").description("Redeem loyalty reward"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("loyalty.members.redeem", await parseJsonObject(opts.data).catch(fail));
  });
loyaltyMembers
  .command("history <id>")
  .description("List loyalty member transaction history")
  .action(async (id: string) => {
    await callAndPrint("loyalty.members.history", { params: { id } });
  });

const webhooks = addSimpleCrudCommands(program, {
  name: "webhooks",
  path: "webhooks",
  listSearch: false,
});
webhooks
  .command("deliveries <id>")
  .description("List webhook deliveries")
  .option("--limit <n>", "Page size", "50")
  .action(async (id: string, opts: { limit?: string }) => {
    await callAndPrint("webhooks.deliveries", {
      params: { id },
      query: { limit: Number(opts.limit ?? "50") },
    });
  });
webhooks
  .command("replay <deliveryId>")
  .description("Replay webhook delivery")
  .action(async (deliveryId: string) => {
    await callAndPrint("webhooks.replay", { params: { deliveryId } });
  });

const events = program.command("events").description("Inspect events");
events
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("events.list", await listInput(opts));
  });
events
  .command("get <id>")
  .description("Get one event")
  .action(async (id: string) => {
    await callAndPrint("events.get", { params: { id } });
  });

const orders = program.command("orders").description("Manage orders");
addListOptions(orders.command("list").description("List orders"), false)
  .option("--data <json>", "Order list input JSON, @file.json, or - from stdin")
  .action(async (opts: { data?: string; limit?: string; cursor?: string }) => {
    const data = await parseJsonObject(opts.data, await listInput(opts)).catch(fail);
    await callAndPrint("orders.list", data);
  });
orders
  .command("get <id>")
  .description("Get one order")
  .action(async (id: string) => {
    await callAndPrint("orders.get", { params: { id } });
  });
addJsonDataOption(orders.command("create").description("Create an order"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("orders.create", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(orders.command("update <id>").description("Update an order"))
  .action(async (id: string, opts: { data?: string }) => {
    await callAndPrint("orders.update", {
      params: { id },
      body: await parseJsonObject(opts.data).catch(fail),
    });
  });
orders
  .command("cancel <id>")
  .description("Cancel an order")
  .action(async (id: string) => {
    await callAndPrint("orders.cancel", { params: { id } });
  });
orders
  .command("fulfill <id>")
  .description("Mark an order fulfilled")
  .action(async (id: string) => {
    await callAndPrint("orders.fulfill", { params: { id } });
  });
orders
  .command("delete <id>")
  .description("Delete an order")
  .action(async (id: string) => {
    await callAndPrint("orders.delete", { params: { id } });
  });
orders
  .command("redemptions <id>")
  .description("List order redemptions")
  .action(async (id: string) => {
    await callAndPrint("orders.redemptions", { params: { id } });
  });

const apiKeys = program.command("api-keys").description("Manage API keys");
apiKeys.command("list").action(async () => {
  await callAndPrint("apiKeys.list");
});
addJsonDataOption(apiKeys.command("create").description("Mint an API key"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("apiKeys.create", await parseJsonObject(opts.data).catch(fail));
  });
apiKeys
  .command("revoke <id>")
  .description("Revoke an API key")
  .action(async (id: string) => {
    await callAndPrint("apiKeys.revoke", { params: { id } });
  });

const users = program.command("users").description("Manage staff users");
users.command("list").action(async () => {
  await callAndPrint("users.list");
});
addJsonDataOption(users.command("create").description("Create staff user"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("users.create", await parseJsonObject(opts.data).catch(fail));
  });
addJsonDataOption(users.command("reset-password <id>").description("Reset staff password"))
  .action(async (id: string, opts: { data?: string }) => {
    await callAndPrint("users.resetPassword", {
      params: { id },
      body: await parseJsonObject(opts.data).catch(fail),
    });
  });
addJsonDataOption(users.command("set-role <id>").description("Set staff role"))
  .action(async (id: string, opts: { data?: string }) => {
    await callAndPrint("users.setRole", {
      params: { id },
      body: await parseJsonObject(opts.data).catch(fail),
    });
  });
users.command("disable <id>").action(async (id: string) => {
  await callAndPrint("users.disable", { params: { id } });
});
users.command("enable <id>").action(async (id: string) => {
  await callAndPrint("users.enable", { params: { id } });
});

const workspace = program.command("workspace").description("Manage workspace settings");
workspace.command("get").action(async () => {
  await callAndPrint("workspace.get");
});
addJsonDataOption(workspace.command("update").description("Update workspace settings"))
  .action(async (opts: { data?: string }) => {
    await callAndPrint("workspace.update", await parseJsonObject(opts.data).catch(fail));
  });

const auditLog = program.command("audit-log").description("Inspect audit log");
auditLog
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (opts: { limit?: string; cursor?: string }) => {
    await callAndPrint("auditLog.list", await listInput(opts));
  });

const insights = program.command("insights").description("Inspect analytics summaries");
insights.command("summary").action(async () => {
  await callAndPrint("insights.summary");
});

program.command("health").description("Check liveness").action(async () => {
  await callAndPrint("health");
});
program.command("ready").description("Check readiness").action(async () => {
  await callAndPrint("ready");
});

export async function main(argv = process.argv): Promise<void> {
  await program.parseAsync(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(fail);
}
