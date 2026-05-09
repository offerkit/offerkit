import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import pino from "pino";

export interface InitOtelOptions {
  serviceName: string;
  version?: string;
}

const tracer = trace.getTracer("offerkit");

/**
 * Wrap a hot-path async operation in an OpenTelemetry span. The span
 * records the result, error, and the supplied attributes; if OTel
 * isn't configured (no exporter), this is a near-zero-cost no-op
 * thanks to the global no-op tracer.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes: Attributes = {},
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attributes);
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function setSpanAttributes(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
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
