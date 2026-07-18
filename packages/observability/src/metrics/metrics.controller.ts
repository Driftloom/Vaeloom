import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';

import { MetricsService } from './metrics.service';

/**
 * Exposes the Prometheus scrape endpoint at `GET /metrics`.
 *
 * This controller deliberately lives OUTSIDE any global `api/v1` prefix so
 * that Prometheus can scrape it without prefix rewriting. It is registered by
 * `MetricsModule` which is `@Global()`.
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metrics.getMetrics();
  }
}
