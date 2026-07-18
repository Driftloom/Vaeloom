import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsModule, MetricsInterceptor } from '@vaeloom/observability';

import { AuthModule } from './auth/auth.module';
import { GatewayModule } from './gateway/gateway.module';
import { appConfig, authConfig, gatewayConfig, logConfig, serviceAuthConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health.controller';
import { ObservabilityModule } from './observability/observability.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { DocumentsModule } from './documents/documents.module';
import { ResumesModule } from './resumes/resumes.module';
import { ApplicationsModule } from './applications/applications.module';
import { ChatModule } from './chat/chat.module';
import { MemoryModule } from './memory/memory.module';
import { AgentsModule } from './agents/agents.module';
import { EventsModule } from './events/events.module';
import { SearchModule } from './search/search.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { BillingModule } from './billing/billing.module';
import { RateLimitingModule } from './rate-limiting/rate-limiting.module';
import { CacheModule } from './cache/cache.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RolesGuard } from './common/guards/roles.guard';
import { SecretsService } from './common/services/secrets.service';
import { InternalAiService } from './common/services/internal-ai.service';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { PermissionsModule } from './permissions/permissions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [appConfig, authConfig, logConfig, gatewayConfig, serviceAuthConfig],
    }),
    ObservabilityModule,
    MetricsModule,
    PrismaModule,
    TerminusModule,
    AuthModule,
    GatewayModule,
    WorkspacesModule,
    DocumentsModule,
    ResumesModule,
    ApplicationsModule,
    ChatModule,
    MemoryModule,
    AgentsModule,
    EventsModule,
    SearchModule,
    IntegrationsModule,
    BillingModule,
    RateLimitingModule,
    CacheModule,
    PermissionsModule,
  ],
  controllers: [HealthController],
  providers: [
    SecretsService,
    InternalAiService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [SecretsService, InternalAiService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Tenant context is applied to all routes. For unauthenticated routes,
    // it passes through without enforcement. For authenticated routes,
    // it validates the tenant and sets RLS context.
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
