import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { trace, type Span, type Tracer } from '@opentelemetry/api';

import { stopTracing } from './instrumentation';

/**
 * Helpers for working with the active OpenTelemetry tracer. Auto-instrumentation
 * (HTTP + NestJS) is set up at bootstrap by `TracingModule`; this service is for
 * manual spans around business logic.
 */
@Injectable()
export class TracingService implements OnModuleDestroy {
  private readonly tracer: Tracer = trace.getTracer('vaeloom');

  /** Run `fn` inside a new span named `name`, returning its result. */
  async startSpan<T>(name: string, fn: (span: Span) => T | Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      try {
        return await fn(span);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: 2, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  async onModuleDestroy(): Promise<void> {
    await stopTracing();
  }
}
