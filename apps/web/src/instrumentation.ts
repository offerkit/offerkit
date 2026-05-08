import { initOtel } from "@open-voucherify/core/observability";

export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  initOtel({ serviceName: "open-voucherify-web" });

  if (process.env["DATABASE_URL"]) {
    const { runMigrations } = await import("@open-voucherify/db");
    await runMigrations(process.env["DATABASE_URL"]);

    const { seedAdmin } = await import("./server/seed-admin.ts");
    await seedAdmin();
  }
}
