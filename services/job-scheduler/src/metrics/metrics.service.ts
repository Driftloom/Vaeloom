import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface MetricLabels {
  [key: string]: string;
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;
  private readonly prefix: string;

  private events!: Counter<string>;
  private httpRequests!: Counter<string>;
  private httpDuration!: Histogram<string>;
  private activeConnections!: Gauge<string>;

  constructor(prefix = 'job_scheduler_') {
    this.prefix = prefix;
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: 'job-scheduler' });
  }

  onModuleInit(): void {
    this.events = new Counter({
      name: `${this.prefix}events_total`,
      help: 'Total number of business events emitted',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.httpRequests = new Counter({
      name: `${this.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'status_code'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: `${this.prefix}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: `${this.prefix}active_connections`,
      help: 'Number of active connections',
      registers: [this.registry],
    });
  }

  recordEvent(type: string, status: 'success' | 'failure' = 'success', labels: MetricLabels = {}): void {
    this.events.inc({ type, status, ...labels });
  }

  recordHttpRequest(method: string, statusCode: number | string, labels: MetricLabels = {}): void {
    this.httpRequests.inc({ method, status_code: String(statusCode), ...labels });
  }

  observeHttpDuration(method: string, route: string, seconds: number): void {
    this.httpDuration.observe({ method, route }, seconds);
  }

  incActiveConnections(): void {
    this.activeConnections.inc();
  }

  decActiveConnections(): void {
    this.activeConnections.dec();
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }
}
