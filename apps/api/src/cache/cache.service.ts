import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const defaultTtl = this.config.get<number>('cache.ttl') ?? 300;
    await this.cache.set(key, value, ttl ?? defaultTtl);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async invalidate(pattern: string): Promise<void> {
    const store = this.cache as Cache & { keys: (pattern: string) => Promise<string[]> };
    if (typeof store.keys === 'function') {
      const keys = await store.keys(pattern);
      await Promise.all(keys.map((k) => this.cache.del(k)));
    }
  }
}
