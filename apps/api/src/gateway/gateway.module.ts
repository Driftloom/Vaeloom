import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout: config.get<number>('gateway.timeout') ?? 10000,
        maxRedirects: 0,
      }),
    }),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
