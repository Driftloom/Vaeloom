import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SemanticResourceAttributes,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

let sdk: NodeSDK | undefined;

export interface TracingOptions {
  serviceName: string;
  /** OTLP HTTP collector endpoint. Falls back to OTEL_EXPORTER_OTLP_ENDPOINT or localhost. */
  endpoint?: string;
}

/**
 * Bootstraps the OpenTelemetry NodeSDK with HTTP + NestJS auto-instrumentation
 * and an OTLP/HTTP exporter. Idempotent: only the first call starts the SDK.
 */
export function startTracing(options: TracingOptions): NodeSDK | undefined {
  if (sdk) {
    return sdk;
  }

  const endpoint =
    options.endpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    'http://localhost:4318';

  const exporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
  });

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.SERVICE_VERSION ?? '0.1.0',
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: exporter,
    instrumentations: [new HttpInstrumentation(), new NestInstrumentation()],
  });

  sdk.start();
  return sdk;
}

/** Stops the SDK (used in tests / graceful shutdown). */
export async function stopTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
  }
}
