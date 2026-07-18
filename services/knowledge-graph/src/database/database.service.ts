import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({
      connectionString: this.config.get<string>('database.url'),
      max: this.config.get<number>('database.maxConnections') ?? 20,
      idleTimeoutMillis: this.config.get<number>('database.idleTimeoutMs') ?? 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  getPool(): Pool {
    return this.pool;
  }
}
