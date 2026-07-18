import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: MetricsService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MetricsService(config.get<string>('metrics.prefix') ?? 'job_scheduler_'),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
