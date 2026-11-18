import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import { startTracing, stopTracing } from '../instrumentation';

jest.mock('@opentelemetry/sdk-node', () => {
  const start = jest.fn();
  const shutdown = jest.fn().mockResolvedValue(undefined);
  const NodeSDK = jest.fn().mockImplementation(() => ({ start, shutdown }));
  return { NodeSDK, __mock: { start, shutdown } };
});

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation((config) => ({ config })),
}));

interface MockedSdkModule {
  __mock: { start: jest.Mock; shutdown: jest.Mock };
}

const sdkMock = jest.requireMock<MockedSdkModule>('@opentelemetry/sdk-node').__mock;

describe('startTracing', () => {
  afterEach(async () => {
    await stopTracing();
    jest.clearAllMocks();
  });

  it('boots a single NodeSDK with the service resource and both instrumentations', () => {
    const sdk = startTracing({ serviceName: 'vaeloom-test' });

    expect(sdk).toBeDefined();
    expect(NodeSDK).toHaveBeenCalledTimes(1);
    expect(sdkMock.start).toHaveBeenCalledTimes(1);

    const config = (NodeSDK as unknown as jest.Mock).mock.calls[0][0] as {
      resource: { attributes: Record<string, unknown> };
      instrumentations: unknown[];
    };

    expect(config.resource.attributes[SemanticResourceAttributes.SERVICE_NAME]).toBe(
      'vaeloom-test',
    );
    expect(config.instrumentations).toHaveLength(2);
    expect(config.instrumentations[0]).toBeInstanceOf(HttpInstrumentation);
    expect(config.instrumentations[1]).toBeInstanceOf(NestInstrumentation);

    const exporterConfig = (OTLPTraceExporter as unknown as jest.Mock).mock.calls[0][0] as {
      url: string;
    };
    expect(exporterConfig.url).toBe('http://localhost:4318/v1/traces');
  });

  it('honours an explicit endpoint and strips the trailing slash', () => {
    startTracing({ serviceName: 'vaeloom-test', endpoint: 'http://collector:4318/' });

    const exporterConfig = (OTLPTraceExporter as unknown as jest.Mock).mock.calls[0][0] as {
      url: string;
    };
    expect(exporterConfig.url).toBe('http://collector:4318/v1/traces');
  });

  it('is idempotent until the SDK is stopped', async () => {
    const first = startTracing({ serviceName: 'vaeloom-test' });
    const second = startTracing({ serviceName: 'vaeloom-test' });

    expect(second).toBe(first);
    expect(NodeSDK).toHaveBeenCalledTimes(1);

    await stopTracing();
    expect(sdkMock.shutdown).toHaveBeenCalledTimes(1);

    const third = startTracing({ serviceName: 'vaeloom-test' });
    expect(third).not.toBe(first);
    expect(NodeSDK).toHaveBeenCalledTimes(2);
  });
});
