import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.checkServiceInfo()]);
  }

  private async checkServiceInfo(): Promise<HealthIndicatorResult> {
    return { service: { status: 'up', timestamp: new Date().toISOString(), version: '0.1.0' } };
  }
}
