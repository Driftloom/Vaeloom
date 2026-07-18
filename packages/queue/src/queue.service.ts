import { Queue, Worker, type QueueOptions, type WorkerOptions, type JobsOptions, type ConnectionOptions, type Job } from 'bullmq';
import { Redis } from 'ioredis';

export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface TypedJob<T = unknown> {
  name: string;
  data: T;
  opts?: JobsOptions;
}

export interface QueueServiceOptions {
  defaultJobOptions?: JobsOptions;
  connection?: ConnectionOptions;
}

const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600 * 24 * 3 },
  removeOnFail: { age: 3600 * 24 * 7 },
};

function resolveConnection(config?: QueueConfig): ConnectionOptions {
  if (config) {
    return { host: config.host, port: config.port, password: config.password, db: config.db ?? 0 };
  }
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379/0';
  return { url: redisUrl };
}

export class QueueService {
  private readonly queue: Queue;
  private readonly worker?: Worker;
  private readonly connection: ConnectionOptions;

  constructor(
    queueName: string,
    config?: QueueConfig,
    opts?: QueueServiceOptions,
  ) {
    this.connection = resolveConnection(config);
    this.queue = new Queue(queueName, {
      connection: this.connection,
      defaultJobOptions: { ...DEFAULT_JOB_OPTS, ...opts?.defaultJobOptions },
      ...opts,
    } as QueueOptions);
  }

  get name(): string {
    return this.queue.name;
  }

  async add<T>(jobName: string, data: T, opts?: JobsOptions): Promise<Job<T>> {
    return this.queue.add(jobName, data, opts);
  }

  async addBulk<T>(jobs: TypedJob<T>[]): Promise<Job<T>[]> {
    return this.queue.addBulk(jobs.map((j) => ({ name: j.name, data: j.data, opts: j.opts })));
  }

  async addRepeatable<T>(jobName: string, data: T, pattern: string, opts?: JobsOptions): Promise<Job<T>> {
    return this.queue.add(jobName, data, { ...opts, repeat: { pattern } });
  }

  async getJob<T>(jobId: string): Promise<Job<T> | undefined> {
    return this.queue.getJob(jobId);
  }

  async getJobs<T>(status?: string): Promise<Job<T>[]> {
    return this.queue.getJobs(status as any);
  }

  async count(): Promise<number> {
    return this.queue.count();
  }

  async pause(): Promise<void> {
    return this.queue.pause();
  }

  async resume(): Promise<void> {
    return this.queue.resume();
  }

  async obliterate(): Promise<void> {
    await this.queue.obliterate();
  }

  createWorker(handler: (job: Job) => Promise<void>, opts?: Partial<WorkerOptions>): Worker {
    return new Worker(this.queue.name, handler, {
      connection: this.connection,
      concurrency: opts?.concurrency ?? 5,
      ...opts,
    } as WorkerOptions);
  }

  getQueue(): Queue {
    return this.queue;
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}

export function createConnection(config?: QueueConfig): Redis {
  const opts = resolveConnection(config);
  if (opts.url) return new Redis(opts.url);
  return new Redis({ host: opts.host, port: opts.port, password: opts.password, db: opts.db ?? 0 } as any);
}

export function createQueue(queueName: string, config?: QueueConfig, opts?: QueueServiceOptions): QueueService {
  return new QueueService(queueName, config, opts);
}
