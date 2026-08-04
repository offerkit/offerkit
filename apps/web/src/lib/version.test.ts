import { describe, expect, it } from "vitest";
import { docsUrlForVersion } from "./version";

describe("docsUrlForVersion", () => {
  it.each([undefined, "edge", "main", "next"])(
    "points an unreleased %s build at next",
    (version) => {
      expect(docsUrlForVersion(version)).toBe("https://offerkit.dev/docs/next");
    },
  );

  it("uses the product major/minor line for stable releases", () => {
    expect(docsUrlForVersion("0.1.1")).toBe("https://offerkit.dev/docs/v/0.1");
    expect(docsUrlForVersion("v2.4.9")).toBe("https://offerkit.dev/docs/v/2.4");
  });

  it("falls back to the latest stable docs for an unknown version format", () => {
    expect(docsUrlForVersion("custom-build")).toBe("https://offerkit.dev/docs");
  });
});
