import { Module } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { MetricsService } from '../metrics/metrics.service';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { SchedulerService } from './scheduler.service';

@Module({
  controllers: [JobController],
  providers: [JobService, SchedulerService, DatabaseService, MetricsService],
  exports: [JobService, SchedulerService],
})
export class JobModule {}
