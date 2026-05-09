// Public surface for the redemption domain. Implementation lives in
// per-function files (validate, redeem, stack, rollback) so each module
// stays under the cognitive-complexity threshold and is easy to test
// in isolation. Shared types are in types.ts; helpers in shared.ts.

export { validate } from "./validate.ts";
export { redeem } from "./redeem.ts";
export { stackRedeem } from "./stack.ts";
export { rollback } from "./rollback.ts";
export type {
  RedeemFailure,
  RedeemInput,
  RedeemResult,
  RedeemSuccess,
  RedemptionFailureCode,
  StackEntry,
  StackRedeemInput,
  StackRedeemResult,
  StackRedeemSuccess,
  ValidateInput,
  ValidateResult,
} from "./types.ts";
