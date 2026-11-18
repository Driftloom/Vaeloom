import { NodeSDK } from '@opentelemetry/sdk-node';

import { startTracing, stopTracing } from '../instrumentation';

// Smoke test for the real OpenTelemetry SDK family: the 0.301 line must boot
// with the HTTP and NestJS instrumentations and shut down without leaving
// handles behind. No spans are produced, so nothing is exported.
describe('startTracing (real SDK)', () => {
  afterEach(async () => {
    await stopTracing();
  });

  it('starts a NodeSDK and shuts it down cleanly', async () => {
    const sdk = startTracing({ serviceName: 'observability-boot-test' });

    expect(sdk).toBeInstanceOf(NodeSDK);

    await expect(stopTracing()).resolves.toBeUndefined();
  });
});
