import pino from "pino";

export interface InitOtelOptions {
  serviceName: string;
  version?: string;
}

let initialized = false;

export function initOtel(options: InitOtelOptions): void {
  if (initialized) return;
  initialized = true;

  if (process.env["OTEL_SDK_DISABLED"] === "true") {
    return;
  }

  // The OpenTelemetry SDK is dynamically imported so this module stays
  // importable from edge / browser bundles without pulling Node-only deps.
  void import("./otel-node.ts").then((mod) => {
    mod.startNodeSdk(options);
  });
}

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
});
