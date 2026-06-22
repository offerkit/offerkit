import { describe, expect, it } from "vitest";
import { TEST_DB_URL, rawRequest } from "./_helpers";

describe("health and readiness probes", () => {
  it("returns liveness and database readiness through the public routes", async () => {
    if (TEST_DB_URL) process.env["DATABASE_URL"] = TEST_DB_URL;
    const health = await rawRequest(new Request("http://test.local/api/v1/health"));
    expect(health.ok).toBe(true);
    await expect(health.json()).resolves.toMatchObject({ status: "ok" });

    const ready = await rawRequest(new Request("http://test.local/api/v1/ready"));
    expect(ready.ok).toBe(true);
    const dbExpected = Boolean(TEST_DB_URL);
    await expect(ready.json()).resolves.toMatchObject({
      status: dbExpected ? "ok" : "degraded",
      checks: { db: dbExpected, worker: true },
    });
  });
});
