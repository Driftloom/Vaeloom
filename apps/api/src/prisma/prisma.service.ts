import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaClient } from '../generated/prisma';

/**
 * PrismaService owns the single Prisma connection pool for the api process.
 * It connects on module init and disconnects on shutdown so Nest's lifecycle
 * fully controls the DB handle (no dangling connections in tests or on SIGTERM).
 * Pool sizing is driven by environment config (DB_POOL_MIN, DB_POOL_MAX, etc.).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
