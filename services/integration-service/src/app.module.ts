import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';

import {
  appConfig,
  authConfig,
  databaseConfig,
  integrationConfig,
  logConfig,
  metricsConfig,
} from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { IntegrationModule } from './integration/integration.module';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, integrationConfig, logConfig, metricsConfig],
    }),
    HttpModule.register({ timeout: 15000, maxRedirects: 3 }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    MetricsModule,
    IntegrationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
