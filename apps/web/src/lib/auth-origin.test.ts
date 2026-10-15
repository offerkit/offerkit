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

// The Next.js standalone server builds request.url from its bind address, not
// from the address the browser connected to, so every request looks like
// localhost:3000 here while Host carries the real address.
const SERVER_URL = "http://localhost:3000";

function authRequest(
  path: "sign-in" | "sign-up",
  requestOrigin: string,
  email: string,
  browserOrigin = requestOrigin,
  extraHeaders: Record<string, string> = {},
) {
  return new Request(`${SERVER_URL}/api/auth/${path}/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: new URL(requestOrigin).host,
      origin: browserOrigin,
      "sec-fetch-site": browserOrigin === requestOrigin ? "same-origin" : "cross-site",
      ...extraHeaders,
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

  it("accepts a same-origin loopback IP sign-in", async () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const origin = "http://127.0.0.1:3000";
    const email = await createUser(testAuth, origin);

    const response = await testAuth.handler(authRequest("sign-in", origin, email));

    expect(response.status).toBe(200);
  });

  it("uses X-Forwarded-Proto for the scheme behind a TLS proxy", async () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const origin = "https://offerkit.example.com";
    const proxied = { "x-forwarded-proto": "https" };
    const email = `${crypto.randomUUID()}@example.com`;
    expect(
      (await testAuth.handler(authRequest("sign-up", origin, email, origin, proxied))).status,
    ).toBe(200);

    const response = await testAuth.handler(
      authRequest("sign-in", origin, email, origin, proxied),
    );

    expect(response.status).toBe(200);
  });

  it("does not let X-Forwarded-Host vouch for a cross-site origin", async () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    delete process.env["BETTER_AUTH_TRUSTED_ORIGINS"];
    const testAuth = createTestAuth();
    const origin = "http://192.168.1.108:3000";
    const email = await createUser(testAuth, origin);

    const response = await testAuth.handler(
      authRequest("sign-in", origin, email, "https://attacker.example.com", {
        "x-forwarded-host": "attacker.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    expect(response.status).toBe(403);
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

describe("inferredRequestOrigin", () => {
  function request(headers: Record<string, string>) {
    return new Request(`${SERVER_URL}/api/auth/sign-in/email`, { method: "POST", headers });
  }

  it("derives the origin from Host rather than request.url", () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    expect(inferredRequestOrigin(request({ host: "192.168.1.108:3000" }))).toEqual([
      "http://192.168.1.108:3000",
    ]);
  });

  it("supports IPv6 hosts", () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    expect(inferredRequestOrigin(request({ host: "[::1]:3000" }))).toEqual([
      "http://[::1]:3000",
    ]);
  });

  it("ignores unknown forwarded schemes", () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    expect(
      inferredRequestOrigin(request({ host: "lan.test:3000", "x-forwarded-proto": "javascript" })),
    ).toEqual(["http://lan.test:3000"]);
  });

  it("rejects Host values that smuggle URL components", () => {
    delete process.env["OFFERKIT_PUBLIC_URL"];
    for (const host of ["attacker.example@lan.test", "lan.test/evil", "lan.test?x", "lan.test#x"]) {
      expect(inferredRequestOrigin(request({ host }))).toEqual([]);
    }
  });

  it("trusts nothing extra when a canonical URL is configured", () => {
    process.env["OFFERKIT_PUBLIC_URL"] = "https://offerkit.example.com";
    expect(inferredRequestOrigin(request({ host: "192.168.1.108:3000" }))).toEqual([]);
  });
});
