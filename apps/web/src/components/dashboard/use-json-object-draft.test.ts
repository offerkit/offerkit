import { describe, expect, it } from "vitest";
import { parseJsonObject } from "./use-json-object-draft";

describe("parseJsonObject", () => {
  it("accepts JSON objects", () => {
    expect(parseJsonObject('{"enabled":true}')).toEqual({
      ok: true,
      value: { enabled: true },
    });
  });

  it.each(["[]", "null", '"text"', "42"])("rejects non-object JSON: %s", (input) => {
    expect(parseJsonObject(input)).toEqual({ ok: false, reason: "not-object" });
  });

  it("returns the parser error for invalid JSON", () => {
    const result = parseJsonObject("{");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });
});
