import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        const storeType = config.get<string>('cache.store') ?? 'memory';
        const ttl = config.get<number>('cache.ttl') ?? 300;

        if (storeType === 'redis') {
          try {
            const { default: KeyvRedis } = await import('@keyv/redis');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = new KeyvRedis(`redis://${config.get<string>('redis.host') ?? 'localhost'}:${config.get<number>('redis.port') ?? 6379}`) as any;
            return { store, ttl };
          } catch (e) {
            // fall through to memory store below
          }
        }

        return {
          store: 'memory',
          ttl,
          max: config.get<number>('cache.max') ?? 1000,
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
