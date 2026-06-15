import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig, saveConfig } from "./index";

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
});
