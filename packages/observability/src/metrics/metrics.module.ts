import { Global, Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Global NestJS module that wires Prometheus metrics into a service:
 *
 *  - provides `MetricsService` (singleton prom-client Registry)
 *  - exposes `GET /metrics` (raw Prometheus text, not behind `api/v1`)
 *  - registers the default HTTP metrics (http_requests_total,
 *    http_request_duration_seconds, active_connections)
 *
 * Import this once per service, typically in `AppModule.imports`.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
