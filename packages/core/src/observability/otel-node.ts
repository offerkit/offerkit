import type { InitOtelOptions } from "./index.ts";

export function startNodeSdk(options: InitOtelOptions): void {
  // Lazy require pattern so Next.js bundling for browser/edge stays clean.
  // Auto-instrumentations are loaded if installed; otherwise this becomes a no-op.
  // Detailed wiring lives here so the public API in ./index.ts has zero Node deps.
  void options;
  // Phase 1 ships the surface; full SDK wiring (NodeSDK + auto-instrumentations + OTLP exporter)
  // lands when we add @opentelemetry/sdk-node and friends in a later phase.
}
