import { afterEach, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { inferredRequestOrigin } from "./auth-origin";
import { offerKitPublicUrl } from "./hosted-mcp";

const original = {
  publicUrl: process.env["OFFERKIT_PUBLIC_URL"],
  trustedOrigins: process.env["BETTER_AUTH_TRUSTED_ORIGINS"],
};

afterEach(() => {
  if (original.publicUrl === undefined) delete process.env["OFFERKIT_PUBLIC_URL"];
  else process.env["OFFERKIT_PUBLIC_URL"] = original.publicUrl;
  if (original.trustedOrigins === undefined) {
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
  } else {
    process.env["BETTER_AUTH_TRUSTED_ORIGINS"] = original.trustedOrigins;
  }
});

function createTestAuth() {
  return betterAuth({
    baseURL: offerKitPublicUrl(),
    secret: "test-secret-1234567890123456789012",
    trustedOrigins: inferredRequestOrigin,
    emailAndPassword: { enabled: true },
    advanced: {
      // Better Auth skips origin checks under NODE_ENV=test unless explicitly enabled.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
  });
}

const password = "correct-horse-battery-staple";

function authRequest(
  path: "sign-in" | "sign-up",
  requestOrigin: string,
  email: string,
  browserOrigin = requestOrigin,
) {
  return new Request(`${requestOrigin}/api/auth/${path}/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: browserOrigin,
      "sec-fetch-site": browserOrigin === requestOrigin ? "same-origin" : "cross-site",
    },
    body: JSON.stringify({
      email,
      password,
      name: "LAN user",
    }),
  });
}

async function createUser(
  testAuth: ReturnType<typeof createTestAuth>,
  origin: string,
): Promise<string> {
  const email = `${crypto.randomUUID()}@example.com`;
  const response = await testAuth.handler(authRequest("sign-up", origin, email));
  expect(response.status).toBe(200);
  return email;
}

describe("authentication origin resolution", () => {
  it("accepts a same-origin LAN sign-in when no canonical URL is configured", async () => {
    process.env["OFFERKIT_PUBLIC_URL"] = "";
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const origin = "http://192.168.1.108:3000";
    const email = await createUser(testAuth, origin);

    const response = await testAuth.handler(authRequest("sign-in", origin, email));

    expect(response.status).toBe(200);
  });

  it("still rejects a cross-site origin when the URL is inferred", async () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const origin = "http://192.168.1.108:3000";
    const email = await createUser(testAuth, origin);

    const response = await testAuth.handler(
      authRequest("sign-in", origin, email, "https://attacker.example.com"),
    );

    expect(response.status).toBe(403);
  });

  it("keeps an explicitly configured canonical URL exact", async () => {
    process.env["OFFERKIT_PUBLIC_URL"] = "http://localhost:3000";
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const email = await createUser(testAuth, "http://localhost:3000");

    const response = await testAuth.handler(
      authRequest("sign-in", "http://192.168.1.108:3000", email),
    );

    expect(response.status).toBe(403);
  });

  it("accepts an explicitly trusted origin alongside the canonical URL", async () => {
    process.env["OFFERKIT_PUBLIC_URL"] = "http://localhost:3000";
    process.env["BETTER_AUTH_TRUSTED_ORIGINS"] = "http://192.168.1.108:3000";
    const testAuth = createTestAuth();
    const email = await createUser(testAuth, "http://localhost:3000");

    const response = await testAuth.handler(
      authRequest("sign-in", "http://192.168.1.108:3000", email),
    );

    expect(response.status).toBe(200);
  });
});
