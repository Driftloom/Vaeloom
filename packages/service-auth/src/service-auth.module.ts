import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServiceAuthGuard } from './service-auth.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ServiceAuthGuard,
    },
  ],
  exports: [],
})
export class ServiceAuthModule {}
