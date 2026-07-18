import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';

export function initTelemetry(serviceName: string, environment: string) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
      }),
      exportIntervalMillis: 60000,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new NestInstrumentation(),
      new PgInstrumentation(),
      new RedisInstrumentation(),
    ],
  });

  sdk.start();
  process.on('SIGTERM', () => sdk.shutdown());
  return sdk;
}
