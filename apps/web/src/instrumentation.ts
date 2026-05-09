import { initOtel } from "@offerkit/core/observability";

export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;

  initOtel({ serviceName: "offerkit-web" });

  if (process.env["DATABASE_URL"]) {
    const { runMigrations } = await import("@offerkit/db");
    await runMigrations(process.env["DATABASE_URL"]);

    const { seedAdmin } = await import("./server/seed-admin.ts");
    await seedAdmin();
  }
}
