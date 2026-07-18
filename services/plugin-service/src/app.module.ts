import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { appConfig, authConfig, databaseConfig, aiConfig, logConfig, pluginConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { MetricsModule } from './metrics/metrics.module';
import { ObservabilityModule } from './observability/observability.module';
import { PluginModule } from './plugin/plugin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, aiConfig, logConfig, pluginConfig],
    }),
    ObservabilityModule,
    DatabaseModule,
    TerminusModule,
    MetricsModule,
    PluginModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
