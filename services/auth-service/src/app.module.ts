import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule, MetricsInterceptor } from '@vaeloom/observability';
import { AuthModule } from './auth/auth.module';
import { appConfig, authConfig, databaseConfig, logConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';

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
    PrismaModule,
    TerminusModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
