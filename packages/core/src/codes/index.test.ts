import { describe, expect, it } from "vitest";
import { generateCode, generateReferralCode, generateUniqueCodes } from "./index.ts";

describe("generateCode", () => {
  it("respects default length (8) and alphanumeric charset", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-Za-z2-9]{8}$/);
    }
  });

  it("excludes confusable characters by default (0/O/1/l/I)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateCode({ length: 12 }));
    for (const code of seen) {
      expect(code).not.toMatch(/[0O1lI]/);
    }
  });

  it("respects prefix and suffix", () => {
    const code = generateCode({ length: 4, prefix: "WELCOME", suffix: "X" });
    expect(code).toMatch(/^WELCOME[A-Za-z2-9]{4}X$/);
  });

  it("allows numeric-only charset", () => {
    for (let i = 0; i < 30; i++) {
      const code = generateCode({ length: 6, charset: "numeric" });
      expect(code).toMatch(/^[2-9]{6}$/);
    }
  });

  it("can opt back into confusable chars", () => {
    let sawConfusable = false;
    for (let i = 0; i < 500; i++) {
      const code = generateCode({ length: 12, excludeConfusable: false });
      if (/[0O1lI]/.test(code)) {
        sawConfusable = true;
        break;
      }
    }
    expect(sawConfusable).toBe(true);
  });

  it("rejects length < 1", () => {
    expect(() => generateCode({ length: 0 })).toThrow();
  });
});

describe("generateReferralCode", () => {
  it("produces {PREFIX}-{code}", () => {
    const code = generateReferralCode("AKSHIT");
    expect(code).toMatch(/^AKSHIT-[A-Za-z2-9]{8}$/);
  });

  it("requires a prefix", () => {
    expect(() => generateReferralCode("")).toThrow();
  });

  it("rejects hyphen in prefix (reserved)", () => {
    expect(() => generateReferralCode("WITH-HYPHEN")).toThrow();
  });
});

describe("generateUniqueCodes", () => {
  it("generates the requested count with no collisions", async () => {
    const codes = await generateUniqueCodes(50, { length: 8 }, () => Promise.resolve(false));
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
  });

  it("rejects existing codes via the exists callback", async () => {
    const taken = new Set(["AAAAAAAA"]);
    const codes = await generateUniqueCodes(
      10,
      { length: 8 },
      (code) => Promise.resolve(taken.has(code)),
    );
    for (const code of codes) {
      expect(code).not.toBe("AAAAAAAA");
    }
  });

  it("throws when the search space is too small", async () => {
    // numeric length 1 = 8 possible codes (excluding confusable 0/1).
    await expect(
      generateUniqueCodes(20, { length: 1, charset: "numeric" }, () => Promise.resolve(false)),
    ).rejects.toThrow();
  });
});
