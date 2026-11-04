import type { NextConfig } from "next";
import { NextRequest } from "next/server";
import {
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "./proxy";

describe("hosted MCP canonical routing", () => {
  it.each(["/mcp", "/MCP", "/mCp", "/MCP/"])(
    "runs the proxy for %s using Next's matcher",
    (pathname) => {
      expect(unstable_doesMiddlewareMatch({ config, url: pathname })).toBe(true);
    },
  );

  it.each(["/", "/mcp/tools", "/api/auth", "/docs/mcp", "/_next/static/app.js"])(
    "does not run the proxy for %s",
    (pathname) => {
      expect(unstable_doesMiddlewareMatch({ config, url: pathname })).toBe(false);
    },
  );

  it("lets the canonical endpoint reach its route without a redirect", () => {
    const response = proxy(new NextRequest("https://offerkit.example.com/mcp"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["GET", "POST", "DELETE"])(
    "canonicalizes %s requests with a method-preserving redirect and the original query",
    (method) => {
      const request = new NextRequest(
        "https://offerkit.example.com/MCP?session=abc&value=one%20two&value=three",
        { method, ...(method === "POST" ? { body: '{"jsonrpc":"2.0"}' } : {}) },
      );
      const response = proxy(request);

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        "https://offerkit.example.com/mcp?session=abc&value=one%20two&value=three",
      );
    },
  );

  it("does not install a case-insensitive config redirect over /mcp", async () => {
    const { default: nextConfig } = (await import(
      new URL("../next.config.mjs", import.meta.url).href
    )) as { default: NextConfig };
    const response = await unstable_getResponseFromNextConfig({
      url: "https://offerkit.example.com/mcp",
      nextConfig,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();

    const docs = await unstable_getResponseFromNextConfig({
      url: "https://offerkit.example.com/docs/self-host?source=dashboard",
      nextConfig,
    });
    expect(docs.status).toBe(308);
    expect(docs.headers.get("location")).toBe(
      "https://offerkit.dev/docs/self-host?source=dashboard",
    );
  });
});
