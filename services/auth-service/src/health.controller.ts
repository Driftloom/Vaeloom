import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.checkServiceInfo(), () => this.checkDatabase()]);
  }

  private async checkServiceInfo(): Promise<HealthIndicatorResult> {
    return { service: { status: 'up', timestamp: new Date().toISOString(), version: '0.1.0' } };
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { database: { status: 'up' } };
    } catch (err) {
      return { database: { status: 'down', message: err instanceof Error ? err.message : 'unknown error' } };
    }
  }
}
