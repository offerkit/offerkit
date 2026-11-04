import { describe, expect, it } from "vitest";
import { translateApiError } from "./api-error-message";

// Marks strings that went through the translation function.
const gt = ((text: string) => `T(${text})`) as unknown as Parameters<typeof translateApiError>[0];

describe("translateApiError", () => {
  it("translates a known domain error code from a loyalty { ok: false, code } result", () => {
    const result = { ok: false, code: "member_not_found", message: "Member not found" };
    expect(translateApiError(gt, result, "Redeem failed")).toBe("T(Loyalty member not found)");
  });

  it("translates a referral { ok: false, errorCode } result as the router returns it", () => {
    const result = {
      ok: false,
      errorCode: "self_referral",
      message: "Referrer cannot also be the referee",
    };
    expect(translateApiError(gt, result, "Convert failed")).toBe(
      "T(Referrer cannot also be the referee)",
    );
  });

  it("prefers errorCode over a referral code carried in `code`", () => {
    const result = {
      ok: false,
      code: "FRIEND-42",
      errorCode: "referee_already_converted",
      message: "already converted",
    };
    expect(translateApiError(gt, result, "Convert failed")).toBe(
      "T(This referee has already converted this referral code)",
    );
  });

  it("translates a known server message behind a generic oRPC code", () => {
    const error = Object.assign(new Error("Campaign not found"), { code: "NOT_FOUND" });
    expect(translateApiError(gt, error, "Update failed")).toBe("T(Campaign not found)");
  });

  it("falls back to the server message for unknown codes and messages", () => {
    const error = Object.assign(new Error("Need 500 points, have 20"), {
      code: "insufficient_points",
    });
    expect(translateApiError(gt, error, "Redeem failed")).toBe("Need 500 points, have 20");
  });

  it("uses the translated fallback when there is no message", () => {
    expect(translateApiError(gt, undefined, "T(Create failed)")).toBe("T(Create failed)");
    expect(translateApiError(gt, { code: "SOMETHING" }, "T(Create failed)")).toBe(
      "T(Create failed)",
    );
  });
});
