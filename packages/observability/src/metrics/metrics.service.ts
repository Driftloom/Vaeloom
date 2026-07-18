import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

import { getRegistry } from './registry';

export interface HttpRequestLabels {
  method: string;
  route: string;
  status: string | number;
}

/**
 * Thin convenience wrapper around a prom-client Registry that also keeps the
 * default Vaeloom HTTP metrics registered and ready for export via the
 * `GET /metrics` endpoint.
 */
@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;
  readonly activeConnections: Gauge<string>;

  constructor() {
    this.registry = getRegistry();

    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests handled, labelled by method, route and status.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds, labelled by method, route and status.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of currently active (in-flight) HTTP connections.',
      registers: [this.registry],
    });
  }

  /** Record a finished HTTP request with its duration in milliseconds. */
  recordHttpRequest(
    method: string,
    route: string,
    status: string | number,
    durationMs: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationMs / 1000);
  }

  incrementActiveConnections(amount = 1): void {
    this.activeConnections.inc(amount);
  }

  decrementActiveConnections(amount = 1): void {
    this.activeConnections.dec(amount);
  }

  incCounter(name: string, labels: Record<string, string | number> = {}): Counter<string> {
    const metric =
      (this.registry.getSingleMetric(name) as Counter<string> | undefined) ??
      new Counter({
        name,
        help: `Custom counter: ${name}`,
        labelNames: Object.keys(labels),
        registers: [this.registry],
      });
    metric.inc(labels);
    return metric;
  }

  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string | number> = {},
  ): Histogram<string> {
    const metric =
      (this.registry.getSingleMetric(name) as Histogram<string> | undefined) ??
      new Histogram({
        name,
        help: `Custom histogram: ${name}`,
        labelNames: Object.keys(labels),
        registers: [this.registry],
      });
    metric.observe(labels, value);
    return metric;
  }

  /** Render the full registry in Prometheus text exposition format. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content type for the Prometheus text format (for HTTP responses). */
  get contentType(): string {
    return this.registry.contentType;
  }
}
