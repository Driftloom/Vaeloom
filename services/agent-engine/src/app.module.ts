import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { appConfig, aiConfig, authConfig, databaseConfig, eventBusConfig, logConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { AgentModule } from './agent/agent.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, aiConfig, eventBusConfig, logConfig],
    }),
    ObservabilityModule,
    DatabaseModule,
    MetricsModule,
    TerminusModule,
    AgentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
