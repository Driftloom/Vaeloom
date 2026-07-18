import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';

import {
  aiConfig,
  appConfig,
  authConfig,
  chunkingConfig,
  databaseConfig,
  logConfig,
  metricsConfig,
} from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DocumentModule } from './document/document.module';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, aiConfig, chunkingConfig, logConfig, metricsConfig],
    }),
    HttpModule.register({ timeout: 30000, maxRedirects: 3 }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    MetricsModule,
    DocumentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
