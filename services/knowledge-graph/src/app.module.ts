import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule, MetricsInterceptor } from '@vaeloom/observability';

import { appConfig, authConfig, databaseConfig, logConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HealthController } from './health.controller';
import { KnowledgeGraphModule } from './knowledge-graph/knowledge-graph.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, databaseConfig, logConfig],
    }),
    ObservabilityModule,
    MetricsModule,
    DatabaseModule,
    TerminusModule,
    KnowledgeGraphModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useFactory: () => new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
