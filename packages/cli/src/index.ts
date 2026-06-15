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

vouchers
  .command("validate <code>")
  .description("Validate a voucher against an order")
  .requiredOption("--amount <cents>", "Order amount in cents")
  .option("--currency <iso>", "Currency", "USD")
  .action(async (code: string, opts: { amount: string; currency: string }) => {
    const c = await client();
    printJSON(
      await c.vouchers
        .validate({
          params: { code },
          body: {
            order: { amount: Number(opts.amount), currency: opts.currency, items: [] },
          },
        })
        .catch(fail),
    );
  });

vouchers
  .command("redeem <code>")
  .description("Redeem a voucher against an order")
  .requiredOption("--amount <cents>", "Order amount in cents")
  .option("--currency <iso>", "Currency", "USD")
  .option("--idempotency-key <key>", "Replay an existing redemption")
  .action(
    async (
      code: string,
      opts: { amount: string; currency: string; idempotencyKey?: string },
    ) => {
      const c = await client();
      printJSON(
        await c.vouchers
          .redeem({
            params: { code },
            body: {
              order: { amount: Number(opts.amount), currency: opts.currency, items: [] },
              ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
            },
          })
          .catch(fail),
      );
    },
  );

const campaigns = program.command("campaigns").description("Manage campaigns");

campaigns
  .command("list")
  .option("--limit <n>", "Page size", "20")
  .action(async (opts: { limit: string }) => {
    const c = await client();
    printJSON(await c.campaigns.list({ limit: Number(opts.limit) }).catch(fail));
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
  .action(async (opts: { name: string; type: string; currency: string }) => {
    const c = await client();
    printJSON(
      await c.campaigns
        .create({
          name: opts.name,
          type: opts.type as "DISCOUNT",
          currency: opts.currency,
        })
        .catch(fail),
    );
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

export async function main(argv = process.argv): Promise<void> {
  await program.parseAsync(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(fail);
}
