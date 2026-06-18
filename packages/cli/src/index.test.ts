import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callBySdkPath, loadConfig, loadConfigDetails, parseJsonInput, saveConfig } from "./index";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "offerkit-cli-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("OFFERKIT_API_URL", undefined);
  vi.stubEnv("OFFERKIT_API_KEY", undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(home, { force: true, recursive: true });
});

describe("CLI config", () => {
  it("uses login config when env overrides are absent", async () => {
    await saveConfig({
      baseUrl: "https://offerkit.example.com",
      apiKey: "offerkit_test_secret",
    });

    await expect(loadConfig()).resolves.toEqual({
      baseUrl: "https://offerkit.example.com",
      apiKey: "offerkit_test_secret",
    });
  });

  it("lets explicit env vars override login config", async () => {
    await saveConfig({
      baseUrl: "https://offerkit.example.com",
      apiKey: "offerkit_test_secret",
    });
    vi.stubEnv("OFFERKIT_API_URL", "https://env.example.com");
    vi.stubEnv("OFFERKIT_API_KEY", "offerkit_env_secret");

    await expect(loadConfig()).resolves.toEqual({
      baseUrl: "https://env.example.com",
      apiKey: "offerkit_env_secret",
    });
  });

  it("reports config sources without exposing the key", async () => {
    await saveConfig({
      baseUrl: "https://offerkit.example.com",
      apiKey: "offerkit_test_secret",
    });
    vi.stubEnv("OFFERKIT_API_URL", "https://env.example.com");

    await expect(loadConfigDetails()).resolves.toEqual({
      config: {
        baseUrl: "https://env.example.com",
        apiKey: "offerkit_test_secret",
      },
      path: join(home, ".offerkitrc"),
      sources: {
        baseUrl: "env",
        apiKey: "file",
      },
    });
  });
});

describe("generic api command helpers", () => {
  it("parses inline JSON input", async () => {
    await expect(parseJsonInput('{"params":{"code":"WAPP25"}}')).resolves.toEqual({
      params: { code: "WAPP25" },
    });
  });

  it("parses JSON input from @file", async () => {
    const file = join(home, "input.json");
    await writeFile(file, '{"name":"WAPP25"}', "utf8");

    await expect(parseJsonInput(`@${file}`)).resolves.toEqual({ name: "WAPP25" });
  });

  it("calls nested SDK procedures by dotted path", async () => {
    const create = vi.fn(async (input: unknown) => ({ ok: true, input }));
    const client = Object.assign(() => undefined, {
      vouchers: {
        create: Object.assign(create, {}),
      },
    });

    await expect(
      callBySdkPath(client as never, "vouchers.create", { code: "WAPP25" }),
    ).resolves.toEqual({ ok: true, input: { code: "WAPP25" } });
    expect(create).toHaveBeenCalledWith({ code: "WAPP25" });
  });

  it("fails when the dotted path is not callable", async () => {
    await expect(callBySdkPath({ vouchers: {} } as never, "vouchers.create", {})).rejects.toThrow(
      /did not resolve to a callable/,
    );
  });
});
