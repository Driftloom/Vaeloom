import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import {
  appConfig,
  authConfig,
  databaseConfig,
  logConfig,
  metricsConfig,
  slackConfig,
  smtpConfig,
} from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationModule } from './notification/notification.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, logConfig, metricsConfig, smtpConfig, slackConfig],
    }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    NotificationModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
