import { Global, Module, type OnModuleInit } from '@nestjs/common';

import { startTracing } from './instrumentation';
import { TracingService } from './tracing.service';

export interface TracingModuleOptions {
  serviceName: string;
  endpoint?: string;
}

/**
 * Enables OpenTelemetry tracing for a NestJS service.
 *
 * On init it starts the NodeSDK with OTLP/HTTP export and HTTP + NestJS
 * auto-instrumentation. The `TracingService` is provided for manual spans.
 *
 * Wire it up by calling `TracingModule.forRoot({ serviceName: 'memory-store' })`
 * inside `AppModule.imports`.
 */
@Global()
@Module({
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule implements OnModuleInit {
  private static options: TracingModuleOptions = { serviceName: 'vaeloom' };

  static forRoot(options: TracingModuleOptions): typeof TracingModule {
    TracingModule.options = options;
    return TracingModule;
  }

  async onModuleInit(): Promise<void> {
    startTracing(TracingModule.options);
  }
}
