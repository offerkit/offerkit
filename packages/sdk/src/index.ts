// open-voucherify SDK — typed RPC client built over the oRPC contract.
// Phase 8 fills this with a fetch-based @orpc/client wrapper plus a
// REST convenience layer mirroring voucherify-js-sdk for migration parity.
export interface SdkOptions {
  baseUrl: string;
  apiKey: string;
}

export function createClient(options: SdkOptions): SdkOptions {
  // Placeholder until Phase 8.
  return options;
}
