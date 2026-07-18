import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { appConfig, authConfig, databaseConfig, aiConfig, logConfig, metricsConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';
import { RecommendationModule } from './recommendation/recommendation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, aiConfig, logConfig, metricsConfig],
    }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    MetricsModule,
    RecommendationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
