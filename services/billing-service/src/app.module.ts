import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { appConfig, authConfig, databaseConfig, logConfig, metricsConfig, stripeConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { BillingModule } from './billing/billing.module';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, logConfig, metricsConfig, stripeConfig],
    }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    BillingModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
