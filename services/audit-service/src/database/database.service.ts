import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 20),
      idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT ?? 30000),
    });

    this.pool.on('error', (err) => {
      this.logger.error({ err }, 'Unexpected database pool error');
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  getPool(): Pool {
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database pool');
    await this.pool.end();
  }
}
