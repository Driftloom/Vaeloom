import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

export class TestContainerManager {
  private postgres?: StartedPostgreSqlContainer;
  private redis?: StartedRedisContainer;

  async start() {
    this.postgres = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('vaeloom_test')
      .withUsername('vaeloom')
      .withPassword('vaeloom_test')
      .start();

    this.redis = await new RedisContainer('redis:7-alpine').start();

    process.env.DATABASE_URL = this.postgres.getConnectionUri();
    process.env.REDIS_URL = this.redis.getConnectionUri();

    return { postgres: this.postgres, redis: this.redis };
  }

  async stop() {
    await this.postgres?.stop();
    await this.redis?.stop();
  }
}
