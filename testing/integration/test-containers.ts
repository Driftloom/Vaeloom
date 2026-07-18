import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

export interface TestContainerConfig {
  postgresImage?: string;
  redisImage?: string;
  postgresDb?: string;
  postgresUser?: string;
  postgresPassword?: string;
  reuseContainers?: boolean;
}

export class TestContainerManager {
  private postgres?: StartedPostgreSqlContainer;
  private redis?: StartedRedisContainer;
  private config: Required<TestContainerConfig>;

  constructor(config: TestContainerConfig = {}) {
    this.config = {
      postgresImage: config.postgresImage || 'postgres:16-alpine',
      redisImage: config.redisImage || 'redis:7-alpine',
      postgresDb: config.postgresDb || 'vaeloom_test',
      postgresUser: config.postgresUser || 'vaeloom',
      postgresPassword: config.postgresPassword || 'vaeloom_test',
      reuseContainers: config.reuseContainers ?? false,
    };
  }

  async start() {
    this.postgres = await new PostgreSqlContainer(this.config.postgresImage)
      .withDatabase(this.config.postgresDb)
      .withUsername(this.config.postgresUser)
      .withPassword(this.config.postgresPassword)
      .withReuse(this.config.reuseContainers)
      .start();

    this.redis = await new RedisContainer(this.config.redisImage)
      .withReuse(this.config.reuseContainers)
      .start();

    const connectionString = this.postgres.getConnectionUri();
    const redisUrl = `redis://${this.redis.getHost()}:${this.redis.getPort()}`;

    process.env.DATABASE_URL = connectionString;
    process.env.REDIS_URL = redisUrl;
    process.env.PGHOST = this.postgres.getHost();
    process.env.PGPORT = String(this.postgres.getPort());
    process.env.PGDATABASE = this.config.postgresDb;
    process.env.PGUSER = this.config.postgresUser;
    process.env.PGPASSWORD = this.config.postgresPassword;

    return {
      postgres: this.postgres,
      redis: this.redis,
      connectionString,
      redisUrl,
    };
  }

  async stop() {
    await this.postgres?.stop();
    await this.redis?.stop();
  }

  getPostgresUri(): string {
    if (!this.postgres) throw new Error('PostgreSQL not started');
    return this.postgres.getConnectionUri();
  }

  getRedisUri(): string {
    if (!this.redis) throw new Error('Redis not started');
    return `redis://${this.redis.getHost()}:${this.redis.getPort()}`;
  }
}
