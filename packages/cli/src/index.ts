#!/usr/bin/env node
import { createRequire } from "node:module";
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

type ConfigSource = "default" | "file" | "env";

export interface LoadedConfig {
  config: Config;
  path: string;
  sources: {
    baseUrl: ConfigSource;
    apiKey: Exclude<ConfigSource, "default"> | "none";
  };
}

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: unknown };
const packageVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";

function rcPath(): string {
  return join(homedir(), ".offerkitrc");
}

export async function loadConfigDetails(): Promise<LoadedConfig> {
  const cfg: Config = { baseUrl: "http://localhost:3000" };
  const sources: LoadedConfig["sources"] = { baseUrl: "default", apiKey: "none" };
  try {
    const raw = await readFile(rcPath(), "utf8");
    const fromFile = JSON.parse(raw) as Config;
    if (fromFile.baseUrl) {
      cfg.baseUrl = fromFile.baseUrl;
      sources.baseUrl = "file";
    }
    if (fromFile.apiKey) {
      cfg.apiKey = fromFile.apiKey;
      sources.apiKey = "file";
    }
  } catch {
    // Missing or unreadable config files fall back to explicit env or localhost.
  }
  if (process.env["OFFERKIT_API_URL"]) {
    cfg.baseUrl = process.env["OFFERKIT_API_URL"];
    sources.baseUrl = "env";
  }
  if (process.env["OFFERKIT_API_KEY"]) {
    cfg.apiKey = process.env["OFFERKIT_API_KEY"];
    sources.apiKey = "env";
  }
  return { config: cfg, path: rcPath(), sources };
}

export async function loadConfig(): Promise<Config> {
  return (await loadConfigDetails()).config;
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    throw new Error(`Invalid JSON input: ${detail}`, { cause: err });
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function parseJsonObject<T extends JsonRecord = JsonRecord>(
  raw: string | undefined,
  fallback: T = {} as T,
): Promise<T> {
  const parsed = await parseJsonInput(raw);
  if (parsed === undefined) return fallback;
  if (!isRecord(parsed)) throw new Error("JSON input must be an object");
  return parsed as T;
}

async function parseOptionalJsonObject<T extends JsonRecord = JsonRecord>(
  raw: string | undefined,
): Promise<T | undefined> {
  if (raw === undefined) return undefined;
  return parseJsonObject<T>(raw);
}

function assignDefined<T extends JsonRecord>(target: JsonRecord, values: Partial<T>): T {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) target[key] = value;
  }
  return target as T;
}

function isIndexable(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function intOption(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Expected integer, got ${value}`);
  return parsed;
}

function enumOption<const TValue extends string>(allowed: readonly TValue[]) {
  return (value: string): TValue => {
    if (allowed.includes(value as TValue)) return value as TValue;
    throw new Error(`Expected one of ${allowed.join(", ")}, got ${value}`);
  };
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

function listInput<T extends JsonRecord = JsonRecord>(opts: {
  limit?: string;
  cursor?: string;
  search?: string;
  [key: string]: unknown;
}): T {
  const out: JsonRecord = {};
  if (opts.limit !== undefined) out["limit"] = Number(opts.limit);
  if (opts.cursor !== undefined) out["cursor"] = opts.cursor;
  if (opts.search !== undefined) out["search"] = opts.search;
  return out as T;
}

async function callAndPrint<T>(call: (c: Client) => Promise<T>): Promise<void> {
  const c = await client();
  printJSON(await call(c).catch(fail));
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
program.name("offerkit").description("OfferKit CLI").version(packageVersion);

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
  .command("config")
  .description("Show active CLI config without making an API call")
  .action(async () => {
    const loaded = await loadConfigDetails();
    printJSON({
      configPath: loaded.path,
      baseUrl: loaded.config.baseUrl,
      baseUrlSource: loaded.sources.baseUrl,
      apiKeyConfigured: Boolean(loaded.config.apiKey),
      apiKeySource: loaded.sources.apiKey,
    });
  });

program
  .command("whoami")
  .description("Show the authenticated OfferKit workspace")
  .action(async () => {
    const cfg = await loadConfig();
    const c = await client();
    printJSON({
      baseUrl: cfg.baseUrl,
      workspace: await c.workspace.get().catch(fail),
    });
  });

program
  .command("doctor")
  .description("Check CLI config and deployment connectivity")
  .action(async () => {
    const loaded = await loadConfigDetails();
    const c = createClient({
      baseUrl: loaded.config.baseUrl,
      ...(loaded.config.apiKey ? { apiKey: loaded.config.apiKey } : {}),
    });
    const checks: Array<{ name: string; status: "ok" | "warn" | "error"; message: string }> = [
      {
        name: "config",
        status: "ok",
        message: `Using ${loaded.config.baseUrl} from ${loaded.sources.baseUrl}`,
      },
      {
        name: "apiKey",
        status: loaded.config.apiKey ? "ok" : "warn",
        message: loaded.config.apiKey
          ? `API key configured from ${loaded.sources.apiKey}`
          : "No API key configured; authenticated commands will fail",
      },
    ];

    for (const [name, check] of [
      ["health", () => c.health()],
      ["ready", () => c.ready()],
    ] as const) {
      try {
        await check();
        checks.push({ name, status: "ok", message: "Reachable" });
      } catch (err) {
        checks.push({ name, status: "error", message: errorMessage(err) });
      }
    }

    if (checks.some((check) => check.status === "error")) {
      process.exitCode = 1;
    }
    printJSON({
      configPath: loaded.path,
      baseUrl: loaded.config.baseUrl,
      apiKeyConfigured: Boolean(loaded.config.apiKey),
      checks,
    });
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

type ProcedureInput<T> = T extends (input: infer TInput) => Promise<unknown> ? TInput : never;

function addSimpleCrudCommands<
  TListInput extends JsonRecord,
  TCreateInput extends JsonRecord,
  TUpdatePatch extends JsonRecord,
>(
  parent: Command,
  config: {
    name: string;
    listSearch?: boolean;
    calls: {
      list: (c: Client, input: TListInput) => Promise<unknown>;
      get?: (c: Client, id: string) => Promise<unknown>;
      create: (c: Client, input: TCreateInput) => Promise<unknown>;
      update: (c: Client, id: string, patch: TUpdatePatch) => Promise<unknown>;
      delete: (c: Client, id: string) => Promise<unknown>;
    };
  },
): Command {
  const group = parent.command(config.name).description(`Manage ${config.name}`);

  addListOptions(group.command("list").description(`List ${config.name}`), config.listSearch ?? true)
    .action(async (opts: { limit?: string; cursor?: string; search?: string }) => {
      const input = listInput<TListInput>(opts);
      await callAndPrint((c) => config.calls.list(c, input));
    });

  if (config.calls.get) {
    const get = config.calls.get;
    group
      .command("get <id>")
      .description(`Get one ${config.name}`)
      .action(async (id: string) => {
        await callAndPrint((c) => get(c, id));
      });
  }

  addJsonDataOption(group.command("create").description(`Create ${config.name}`))
    .action(async (opts: { data?: string }) => {
      const input = await parseJsonObject<TCreateInput>(opts.data).catch(fail);
      await callAndPrint((c) => config.calls.create(c, input));
    });

  addJsonDataOption(group.command("update <id>").description(`Update ${config.name}`))
    .action(async (id: string, opts: { data?: string }) => {
      const patch = await parseJsonObject<TUpdatePatch>(opts.data).catch(fail);
      await callAndPrint((c) => config.calls.update(c, id, patch));
    });

  group
    .command("delete <id>")
    .description(`Delete ${config.name}`)
    .action(async (id: string) => {
      await callAndPrint((c) => config.calls.delete(c, id));
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
    .option(
      "--type <type>",
      "DISCOUNT | GIFT_CARD",
      enumOption(["DISCOUNT", "GIFT_CARD"] as const),
      "DISCOUNT",
    )
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
    type: ProcedureInput<Client["vouchers"]["create"]>["type"];
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
            type: "AMOUNT" as const,
            amount: opts.discountAmount,
            ...(opts.maxDiscountAmount !== undefined
              ? { maxDiscountAmount: opts.maxDiscountAmount }
              : {}),
          }
        : opts.discountPercent !== undefined
          ? {
              type: "PERCENTAGE" as const,
              percent: opts.discountPercent,
              ...(opts.maxDiscountAmount !== undefined
                ? { maxDiscountAmount: opts.maxDiscountAmount }
                : {}),
            }
          : undefined;

    await callAndPrint((c) =>
      c.vouchers.create(assignDefined(data, {
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
      })),
    );
  },
);

addJsonDataOption(vouchers.command("update <code>").description("Update a voucher"))
  .action(async (code: string, opts: { data?: string }) => {
    const patch = await parseJsonObject<
      ProcedureInput<Client["vouchers"]["update"]>["body"]["patch"]
    >(opts.data).catch(fail);
    await callAndPrint((c) => c.vouchers.update({
      params: { code },
      body: { patch },
    }));
  });

vouchers
  .command("delete <code>")
  .description("Delete a voucher")
  .action(async (code: string) => {
    await callAndPrint((c) => c.vouchers.delete({ params: { code } }));
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
    await callAndPrint((c) =>
      c.vouchers.bulk(assignDefined(data, {
        campaignId: opts.campaignId,
        count: opts.count,
        discount:
          opts.discountAmount === undefined
            ? undefined
            : { type: "AMOUNT", amount: opts.discountAmount },
        giftBalance: opts.giftBalance,
      })),
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
    const input = await parseJsonObject<ProcedureInput<Client["vouchers"]["qualify"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.vouchers.qualify(input));
  });

addJsonDataOption(vouchers.command("stack-redeem").description("Redeem multiple vouchers atomically"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["vouchers"]["stackRedeem"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.vouchers.stackRedeem(input));
  });

vouchers
  .command("transactions <code>")
  .description("List gift card transactions for a voucher")
  .action(async (code: string) => {
    await callAndPrint((c) => c.vouchers.transactions({ params: { code } }));
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
    await callAndPrint((c) => c.campaigns.get({ params: { id } }));
  });

campaigns
  .command("create")
  .description("Create a campaign")
  .requiredOption("--name <name>", "Campaign name")
  .requiredOption(
    "--type <type>",
    "DISCOUNT | GIFT_VOUCHERS | LOYALTY_PROGRAM | REFERRAL_PROGRAM | PROMOTION",
    enumOption([
      "DISCOUNT",
      "GIFT_VOUCHERS",
      "LOYALTY_PROGRAM",
      "REFERRAL_PROGRAM",
      "PROMOTION",
    ] as const),
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
      type: ProcedureInput<Client["campaigns"]["create"]>["type"];
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
      await callAndPrint((c) =>
        c.campaigns.create(assignDefined(data, {
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
        })),
      );
    },
  );

addJsonDataOption(
  campaigns
    .command("update <id>")
    .description("Update a campaign")
    .option(
      "--status <status>",
      "draft | active | paused | ended",
      enumOption(["draft", "active", "paused", "ended"] as const),
    )
    .option("--validation-rule-id <id>", "Validation rule id")
    .option("--per-user-redemption-limit <n>", "Per-user redemption limit", intOption)
    .option("--auto-apply <value>", "true | false"),
).action(
  async (
    id: string,
    opts: {
      data?: string;
      status?: ProcedureInput<Client["campaigns"]["update"]>["body"]["patch"]["status"];
      validationRuleId?: string;
      perUserRedemptionLimit?: number;
      autoApply?: string;
    },
  ) => {
    const patch = await parseJsonObject(opts.data).catch(fail);
    await callAndPrint((c) => c.campaigns.update({
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
    }));
  });

campaigns
  .command("delete <id>")
  .description("Delete a campaign")
  .action(async (id: string) => {
    await callAndPrint((c) => c.campaigns.delete({ params: { id } }));
  });

const validationRules = program
  .command("validation-rules")
  .alias("rules")
  .description("Manage validation rules");

addListOptions(validationRules.command("list").description("List validation rules"))
  .action(async (opts: { limit?: string; cursor?: string; search?: string }) => {
    const input = listInput<ProcedureInput<Client["validationRules"]["list"]>>(opts);
    await callAndPrint((c) => c.validationRules.list(input));
  });

validationRules
  .command("get <id>")
  .description("Show one validation rule")
  .action(async (id: string) => {
    await callAndPrint((c) => c.validationRules.get({ params: { id } }));
  });

addJsonDataOption(
  validationRules
    .command("create")
    .description("Create a validation rule")
    .option("--name <name>", "Rule name")
    .option("--description <text>", "Description")
    .option(
      "--applies-to <kind>",
      "voucher | promotion | earn | reward",
      enumOption(["voucher", "promotion", "earn", "reward"] as const),
      "voucher",
    )
    .option("--rule <json>", "JSON Logic rule object, @file.json, or - from stdin"),
).action(
  async (opts: {
    data?: string;
    name?: string;
    description?: string;
    appliesTo?: ProcedureInput<Client["validationRules"]["create"]>["appliesTo"];
    rule?: string;
  }) => {
    const data = await parseJsonObject(opts.data).catch(fail);
    const rule = await parseOptionalJsonObject(opts.rule).catch(fail);
    await callAndPrint((c) =>
      c.validationRules.create(assignDefined(data, {
        name: opts.name,
        description: opts.description,
        appliesTo: opts.appliesTo,
        rule,
      })),
    );
  },
);

addJsonDataOption(validationRules.command("update <id>").description("Update a validation rule"))
  .action(async (id: string, opts: { data?: string }) => {
    const patch = await parseJsonObject<
      ProcedureInput<Client["validationRules"]["update"]>["body"]["patch"]
    >(opts.data).catch(fail);
    await callAndPrint((c) => c.validationRules.update({
      params: { id },
      body: { patch },
    }));
  });

validationRules
  .command("delete <id>")
  .description("Delete a validation rule")
  .action(async (id: string) => {
    await callAndPrint((c) => c.validationRules.delete({ params: { id } }));
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
  await callAndPrint((c) => c.customers.getByExternalId({ params: { externalId } }));
});

addJsonDataOption(customers.command("create").description("Create customer"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["customers"]["create"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.customers.create(input));
  });

addJsonDataOption(customers.command("upsert").description("Create or update customer by externalId"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["customers"]["upsert"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.customers.upsert(input));
  });

addJsonDataOption(customers.command("update <id>").description("Update customer"))
  .action(async (id: string, opts: { data?: string }) => {
    const patch = await parseJsonObject<
      ProcedureInput<Client["customers"]["update"]>["body"]["patch"]
    >(opts.data).catch(fail);
    await callAndPrint((c) => c.customers.update({
      params: { id },
      body: { patch },
    }));
  });

customers
  .command("delete <id>")
  .description("Delete customer")
  .action(async (id: string) => {
    await callAndPrint((c) => c.customers.delete({ params: { id } }));
  });

const segments = addSimpleCrudCommands<
  ProcedureInput<Client["segments"]["list"]>,
  ProcedureInput<Client["segments"]["create"]>,
  ProcedureInput<Client["segments"]["update"]>["body"]["patch"]
>(program, {
  name: "segments",
  calls: {
    list: (c, input) => c.segments.list(input),
    get: (c, id) => c.segments.get({ params: { id } }),
    create: (c, input) => c.segments.create(input),
    update: (c, id, patch) => c.segments.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.segments.delete({ params: { id } }),
  },
});
addJsonDataOption(segments.command("preview").description("Preview a segment rule"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["segments"]["preview"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.segments.preview(input));
  });

const promotions = program.command("promotions").description("Manage promotions");
addSimpleCrudCommands<
  ProcedureInput<Client["promotions"]["tiers"]["list"]>,
  ProcedureInput<Client["promotions"]["tiers"]["create"]>,
  ProcedureInput<Client["promotions"]["tiers"]["update"]>["body"]["patch"]
>(promotions, {
  name: "tiers",
  calls: {
    list: (c, input) => c.promotions.tiers.list(input),
    create: (c, input) => c.promotions.tiers.create(input),
    update: (c, id, patch) =>
      c.promotions.tiers.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.promotions.tiers.delete({ params: { id } }),
  },
});
addJsonDataOption(promotions.command("qualify").description("Qualify auto-applied promotions"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["promotions"]["qualify"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.promotions.qualify(input));
  });

addSimpleCrudCommands<
  ProcedureInput<Client["rewardTypes"]["list"]>,
  ProcedureInput<Client["rewardTypes"]["create"]>,
  ProcedureInput<Client["rewardTypes"]["update"]>["body"]["patch"]
>(program, {
  name: "reward-types",
  calls: {
    list: (c, input) => c.rewardTypes.list(input),
    get: (c, id) => c.rewardTypes.get({ params: { id } }),
    create: (c, input) => c.rewardTypes.create(input),
    update: (c, id, patch) => c.rewardTypes.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.rewardTypes.delete({ params: { id } }),
  },
});

const referrals = program.command("referrals").description("Manage referrals");
addSimpleCrudCommands<
  ProcedureInput<Client["referrals"]["programs"]["list"]>,
  ProcedureInput<Client["referrals"]["programs"]["create"]>,
  ProcedureInput<Client["referrals"]["programs"]["update"]>["body"]["patch"]
>(referrals, {
  name: "programs",
  listSearch: false,
  calls: {
    list: (c, input) => c.referrals.programs.list(input),
    get: (c, id) => c.referrals.programs.get({ params: { id } }),
    create: (c, input) => c.referrals.programs.create(input),
    update: (c, id, patch) =>
      c.referrals.programs.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.referrals.programs.delete({ params: { id } }),
  },
});
referrals
  .command("get-by-code <code>")
  .description("Look up a referral code")
  .action(async (code: string) => {
    await callAndPrint((c) => c.referrals.getByCode({ params: { code } }));
  });
addJsonDataOption(referrals.command("issue").description("Issue or fetch a referral code"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["referrals"]["issue"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.referrals.issue(input));
  });
addJsonDataOption(referrals.command("convert").description("Convert a referral"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["referrals"]["convert"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.referrals.convert(input));
  });
referrals
  .command("codes <programId>")
  .description("List referral codes in a program")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    const query = listInput<ProcedureInput<Client["referrals"]["listCodes"]>["query"]>(
      opts,
    );
    await callAndPrint((c) => c.referrals.listCodes({
      params: { programId },
      query,
    }));
  });
referrals
  .command("conversions <codeId>")
  .description("List conversions for a referral code")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (codeId: string, opts: { limit?: string; cursor?: string }) => {
    const query = listInput<
      ProcedureInput<Client["referrals"]["listConversions"]>["query"]
    >(opts);
    await callAndPrint((c) => c.referrals.listConversions({
      params: { codeId },
      query,
    }));
  });
referrals
  .command("program-conversions <programId>")
  .description("List conversions in a referral program")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    const query = listInput<
      ProcedureInput<Client["referrals"]["listProgramConversions"]>["query"]
    >(opts);
    await callAndPrint((c) => c.referrals.listProgramConversions({
      params: { programId },
      query,
    }));
  });

const loyalty = program.command("loyalty").description("Manage loyalty");
addSimpleCrudCommands<
  ProcedureInput<Client["loyalty"]["programs"]["list"]>,
  ProcedureInput<Client["loyalty"]["programs"]["create"]>,
  ProcedureInput<Client["loyalty"]["programs"]["update"]>["body"]["patch"]
>(loyalty, {
  name: "programs",
  listSearch: false,
  calls: {
    list: (c, input) => c.loyalty.programs.list(input),
    get: (c, id) => c.loyalty.programs.get({ params: { id } }),
    create: (c, input) => c.loyalty.programs.create(input),
    update: (c, id, patch) =>
      c.loyalty.programs.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.loyalty.programs.delete({ params: { id } }),
  },
});

function addProgramChildCommands<
  TCreateInput extends JsonRecord,
  TUpdatePatch extends JsonRecord,
>(
  parent: Command,
  config: {
    name: string;
    calls: {
      list: (c: Client, programId: string) => Promise<unknown>;
      create: (c: Client, input: TCreateInput) => Promise<unknown>;
      update: (c: Client, id: string, patch: TUpdatePatch) => Promise<unknown>;
      delete: (c: Client, id: string) => Promise<unknown>;
    };
  },
): void {
  const group = parent.command(config.name).description(`Manage loyalty ${config.name}`);
  group
    .command("list <programId>")
    .description(`List loyalty ${config.name}`)
    .action(async (programId: string) => {
      await callAndPrint((c) => config.calls.list(c, programId));
    });
  addJsonDataOption(group.command("create").description(`Create loyalty ${config.name}`))
    .action(async (opts: { data?: string }) => {
      const input = await parseJsonObject<TCreateInput>(opts.data).catch(fail);
      await callAndPrint((c) => config.calls.create(c, input));
    });
  addJsonDataOption(group.command("update <id>").description(`Update loyalty ${config.name}`))
    .action(async (id: string, opts: { data?: string }) => {
      const patch = await parseJsonObject<TUpdatePatch>(opts.data).catch(fail);
      await callAndPrint((c) => config.calls.update(c, id, patch));
    });
  group
    .command("delete <id>")
    .description(`Delete loyalty ${config.name}`)
    .action(async (id: string) => {
      await callAndPrint((c) => config.calls.delete(c, id));
    });
}

addProgramChildCommands<
  ProcedureInput<Client["loyalty"]["tiers"]["create"]>,
  ProcedureInput<Client["loyalty"]["tiers"]["update"]>["body"]["patch"]
>(loyalty, {
  name: "tiers",
  calls: {
    list: (c, programId) => c.loyalty.tiers.list({ params: { programId } }),
    create: (c, input) => c.loyalty.tiers.create(input),
    update: (c, id, patch) => c.loyalty.tiers.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.loyalty.tiers.delete({ params: { id } }),
  },
});
addProgramChildCommands<
  ProcedureInput<Client["loyalty"]["earningRules"]["create"]>,
  ProcedureInput<Client["loyalty"]["earningRules"]["update"]>["body"]["patch"]
>(loyalty, {
  name: "earning-rules",
  calls: {
    list: (c, programId) => c.loyalty.earningRules.list({ params: { programId } }),
    create: (c, input) => c.loyalty.earningRules.create(input),
    update: (c, id, patch) =>
      c.loyalty.earningRules.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.loyalty.earningRules.delete({ params: { id } }),
  },
});
addProgramChildCommands<
  ProcedureInput<Client["loyalty"]["rewards"]["create"]>,
  ProcedureInput<Client["loyalty"]["rewards"]["update"]>["body"]["patch"]
>(loyalty, {
  name: "rewards",
  calls: {
    list: (c, programId) => c.loyalty.rewards.list({ params: { programId } }),
    create: (c, input) => c.loyalty.rewards.create(input),
    update: (c, id, patch) => c.loyalty.rewards.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.loyalty.rewards.delete({ params: { id } }),
  },
});

const loyaltyMembers = loyalty.command("members").description("Manage loyalty members");
loyaltyMembers
  .command("list <programId>")
  .description("List loyalty members")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (programId: string, opts: { limit?: string; cursor?: string }) => {
    const query = listInput<ProcedureInput<Client["loyalty"]["members"]["list"]>["query"]>(
      opts,
    );
    await callAndPrint((c) => c.loyalty.members.list({
      params: { programId },
      query,
    }));
  });
loyaltyMembers
  .command("get <id>")
  .description("Get loyalty member")
  .action(async (id: string) => {
    await callAndPrint((c) => c.loyalty.members.get({ params: { id } }));
  });
addJsonDataOption(loyaltyMembers.command("enroll").description("Enroll customer"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["loyalty"]["members"]["enroll"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.loyalty.members.enroll(input));
  });
addJsonDataOption(loyaltyMembers.command("earn").description("Earn points"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["loyalty"]["members"]["earn"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.loyalty.members.earn(input));
  });
addJsonDataOption(loyaltyMembers.command("adjust").description("Manual points adjustment"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["loyalty"]["members"]["adjust"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.loyalty.members.adjust(input));
  });
addJsonDataOption(loyaltyMembers.command("redeem").description("Redeem loyalty reward"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["loyalty"]["members"]["redeem"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.loyalty.members.redeem(input));
  });
loyaltyMembers
  .command("history <id>")
  .description("List loyalty member transaction history")
  .action(async (id: string) => {
    await callAndPrint((c) => c.loyalty.members.history({ params: { id } }));
  });

const webhooks = addSimpleCrudCommands<
  JsonRecord,
  ProcedureInput<Client["webhooks"]["create"]>,
  ProcedureInput<Client["webhooks"]["update"]>["body"]["patch"]
>(program, {
  name: "webhooks",
  listSearch: false,
  calls: {
    list: (c) => c.webhooks.list(),
    get: (c, id) => c.webhooks.get({ params: { id } }),
    create: (c, input) => c.webhooks.create(input),
    update: (c, id, patch) => c.webhooks.update({ params: { id }, body: { patch } }),
    delete: (c, id) => c.webhooks.delete({ params: { id } }),
  },
});
webhooks
  .command("deliveries <id>")
  .description("List webhook deliveries")
  .option("--limit <n>", "Page size", "50")
  .action(async (id: string, opts: { limit?: string }) => {
    await callAndPrint((c) => c.webhooks.deliveries({
      params: { id },
      query: { limit: Number(opts.limit ?? "50") },
    }));
  });
webhooks
  .command("replay <deliveryId>")
  .description("Replay webhook delivery")
  .action(async (deliveryId: string) => {
    await callAndPrint((c) => c.webhooks.replay({ params: { id: deliveryId } }));
  });

const events = program.command("events").description("Inspect events");
events
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (opts: { limit?: string; cursor?: string }) => {
    const input = listInput<ProcedureInput<Client["events"]["list"]>>(opts);
    await callAndPrint((c) => c.events.list(input));
  });
events
  .command("get <id>")
  .description("Get one event")
  .action(async (id: string) => {
    await callAndPrint((c) => c.events.get({ params: { id } }));
  });

const orders = program.command("orders").description("Manage orders");
addListOptions(orders.command("list").description("List orders"), false)
  .option("--data <json>", "Order list input JSON, @file.json, or - from stdin")
  .action(async (opts: { data?: string; limit?: string; cursor?: string }) => {
    const fallback = listInput<ProcedureInput<Client["orders"]["list"]>>(opts);
    const data = await parseJsonObject(opts.data, fallback).catch(fail);
    await callAndPrint((c) => c.orders.list(data));
  });
orders
  .command("get <id>")
  .description("Get one order")
  .action(async (id: string) => {
    await callAndPrint((c) => c.orders.get({ params: { id } }));
  });
addJsonDataOption(orders.command("create").description("Create an order"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["orders"]["create"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.orders.create(input));
  });
addJsonDataOption(orders.command("update <id>").description("Update an order"))
  .action(async (id: string, opts: { data?: string }) => {
    const body = await parseJsonObject<ProcedureInput<Client["orders"]["update"]>["body"]>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.orders.update({
      params: { id },
      body,
    }));
  });
orders
  .command("cancel <id>")
  .description("Cancel an order")
  .action(async (id: string) => {
    await callAndPrint((c) => c.orders.cancel({ params: { id } }));
  });
orders
  .command("fulfill <id>")
  .description("Mark an order fulfilled")
  .action(async (id: string) => {
    await callAndPrint((c) => c.orders.fulfill({ params: { id } }));
  });
orders
  .command("delete <id>")
  .description("Delete an order")
  .action(async (id: string) => {
    await callAndPrint((c) => c.orders.delete({ params: { id } }));
  });
orders
  .command("redemptions <id>")
  .description("List order redemptions")
  .action(async (id: string) => {
    await callAndPrint((c) => c.orders.redemptions({ params: { id } }));
  });

const apiKeys = program.command("api-keys").description("Manage API keys");
apiKeys.command("list").action(async () => {
  await callAndPrint((c) => c.apiKeys.list());
});
addJsonDataOption(apiKeys.command("create").description("Mint an API key"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["apiKeys"]["create"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.apiKeys.create(input));
  });
apiKeys
  .command("revoke <id>")
  .description("Revoke an API key")
  .action(async (id: string) => {
    await callAndPrint((c) => c.apiKeys.revoke({ params: { id } }));
  });

const users = program.command("users").description("Manage staff users");
users.command("list").action(async () => {
  await callAndPrint((c) => c.users.list());
});
addJsonDataOption(users.command("create").description("Create staff user"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["users"]["create"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.users.create(input));
  });
users.command("reset-password <id>").description("Reset staff password")
  .action(async (id: string) => {
    await callAndPrint((c) => c.users.resetPassword({ params: { id } }));
  });
addJsonDataOption(users.command("set-role <id>").description("Set staff role"))
  .action(async (id: string, opts: { data?: string }) => {
    const body = await parseJsonObject<ProcedureInput<Client["users"]["setRole"]>["body"]>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.users.setRole({
      params: { id },
      body,
    }));
  });
users.command("disable <id>").action(async (id: string) => {
  await callAndPrint((c) => c.users.disable({ params: { id } }));
});
users.command("enable <id>").action(async (id: string) => {
  await callAndPrint((c) => c.users.enable({ params: { id } }));
});

const workspace = program.command("workspace").description("Manage workspace settings");
workspace.command("get").action(async () => {
  await callAndPrint((c) => c.workspace.get());
});
addJsonDataOption(workspace.command("update").description("Update workspace settings"))
  .action(async (opts: { data?: string }) => {
    const input = await parseJsonObject<ProcedureInput<Client["workspace"]["update"]>>(
      opts.data,
    ).catch(fail);
    await callAndPrint((c) => c.workspace.update(input));
  });

const auditLog = program.command("audit-log").description("Inspect audit log");
auditLog
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .option("--cursor <cursor>", "Pagination cursor")
  .action(async (opts: { limit?: string; cursor?: string }) => {
    const input = listInput<ProcedureInput<Client["auditLog"]["list"]>>(opts);
    await callAndPrint((c) => c.auditLog.list(input));
  });

const insights = program.command("insights").description("Inspect analytics summaries");
insights.command("summary").action(async () => {
  await callAndPrint((c) => c.insights.summary());
});

program.command("health").description("Check liveness").action(async () => {
  await callAndPrint((c) => c.health());
});
program.command("ready").description("Check readiness").action(async () => {
  await callAndPrint((c) => c.ready());
});

export async function main(argv = process.argv): Promise<void> {
  await program.parseAsync(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(fail);
}
