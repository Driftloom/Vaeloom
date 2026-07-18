import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry = new Registry();

  readonly requestCounter: Counter<string>;
  readonly requestDuration: Histogram<string>;
  readonly errorCounter: Counter<string>;
  readonly sandboxExecutions: Counter<string>;
  readonly sandboxFailures: Counter<string>;
  readonly activePlugins: Gauge<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.requestCounter = new Counter({
      name: 'plugin_service_requests_total',
      help: 'Total number of requests handled',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'plugin_service_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'plugin_service_errors_total',
      help: 'Total number of errors',
      labelNames: ['route', 'code'],
      registers: [this.registry],
    });

    this.sandboxExecutions = new Counter({
      name: 'plugin_service_sandbox_executions_total',
      help: 'Total number of sandboxed plugin executions',
      labelNames: ['plugin_id', 'status'],
      registers: [this.registry],
    });

    this.sandboxFailures = new Counter({
      name: 'plugin_service_sandbox_failures_total',
      help: 'Total number of sandboxed plugin execution failures',
      labelNames: ['plugin_id', 'reason'],
      registers: [this.registry],
    });

    this.activePlugins = new Gauge({
      name: 'plugin_service_active_plugins',
      help: 'Number of currently active (enabled) plugins',
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
