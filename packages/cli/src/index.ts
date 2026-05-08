#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("ovx")
  .description("open-voucherify CLI")
  .version("0.0.0");

program
  .command("login")
  .description("Authenticate against an open-voucherify deployment")
  .action(() => {
    // Phase 8 implementation
    process.stdout.write("Phase 8: not yet implemented\n");
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
