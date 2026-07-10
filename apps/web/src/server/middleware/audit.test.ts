import { isContractProcedure, type AnyContractRouter } from "@orpc/contract";
import {
  contract,
  resolveContractOperationRisk,
  resolveOperationRisk,
  type OperationRiskLevel,
  type ProcedureDefinitionMeta,
} from "@offerkit/contract";
import { describe, expect, it } from "vitest";
import { ipFromHeaders, isMutationPath } from "./audit";

interface ContractProcedure {
  path: readonly string[];
  def: ProcedureDefinitionMeta;
}

function* discoverProcedures(
  node: AnyContractRouter,
  path: string[] = [],
): Generator<ContractProcedure> {
  if (isContractProcedure(node)) {
    yield {
      path,
      def: (node as { "~orpc": ProcedureDefinitionMeta })["~orpc"],
    };
    return;
  }

  if (!node || typeof node !== "object") return;
  for (const [key, child] of Object.entries(node as Record<string, AnyContractRouter>)) {
    yield* discoverProcedures(child, [...path, key]);
  }
}

function expectedRisk(def: ProcedureDefinitionMeta): OperationRiskLevel {
  const explicit = def.meta?.operation?.riskLevel ?? def.meta?.mcp?.riskLevel;
  if (explicit) return explicit;
  if (def.route?.method?.toUpperCase() === "GET") return "safe";
  if (def.route?.method?.toUpperCase() === "DELETE") return "destructive";
  return "mutating";
}

const procedures = [...discoverProcedures(contract)];

describe("isMutationPath", () => {
  it.each([
    ["customers.upsert", ["customers", "upsert"]],
    ["vouchers.bulk", ["vouchers", "bulk"]],
    ["referrals.issue", ["referrals", "issue"]],
    ["referrals.convert", ["referrals", "convert"]],
    ["loyalty.members.enroll", ["loyalty", "members", "enroll"]],
    ["apiKeys.revoke", ["apiKeys", "revoke"]],
    ["orders.cancel", ["orders", "cancel"]],
    ["orders.fulfill", ["orders", "fulfill"]],
    ["users.resetPassword", ["users", "resetPassword"]],
    ["users.setRole", ["users", "setRole"]],
  ])("%s is a mutation", (_label, path) => {
    expect(isMutationPath(path)).toBe(true);
  });

  it.each([
    ["segments.preview", ["segments", "preview"]],
    ["promotions.qualify", ["promotions", "qualify"]],
    ["vouchers.validate", ["vouchers", "validate"]],
    ["vouchers.qualify", ["vouchers", "qualify"]],
    ["health", ["health"]],
    ["empty", []],
    ["unknown", ["not", "a", "procedure"]],
  ])("%s is not a mutation", (_label, path) => {
    expect(isMutationPath(path)).toBe(false);
  });

  it("classifies every contract procedure from its route and explicit operation metadata", () => {
    expect(procedures.length).toBeGreaterThan(0);

    for (const procedure of procedures) {
      const expected = expectedRisk(procedure.def);
      expect(resolveOperationRisk(procedure.def), procedure.path.join(".")).toBe(expected);
      expect(resolveContractOperationRisk(contract, procedure.path), procedure.path.join(".")).toBe(
        expected,
      );
      expect(isMutationPath(procedure.path), procedure.path.join(".")).toBe(expected !== "safe");
    }
  });

  it("treats all GET routes as safe and all DELETE routes as destructive", () => {
    for (const procedure of procedures) {
      const method = procedure.def.route?.method?.toUpperCase();
      if (method === "GET") {
        expect(resolveContractOperationRisk(contract, procedure.path), procedure.path.join(".")).toBe(
          "safe",
        );
      }
      if (method === "DELETE") {
        expect(resolveContractOperationRisk(contract, procedure.path), procedure.path.join(".")).toBe(
          "destructive",
        );
      }
    }
  });
});

describe("ipFromHeaders", () => {
  it("returns the first hop in x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 10.0.0.2" });
    expect(ipFromHeaders(h)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.7" });
    expect(ipFromHeaders(h)).toBe("203.0.113.7");
  });

  it("returns null when neither header is present", () => {
    expect(ipFromHeaders(new Headers())).toBeNull();
  });
});
