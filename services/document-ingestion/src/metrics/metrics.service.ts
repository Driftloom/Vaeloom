import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequests: Counter<string>;
  private readonly httpDuration: Histogram<string>;
  private readonly domainEvents: Counter<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: 'document-ingestion' });
    collectDefaultMetrics({ register: this.registry, prefix: 'document_ingestion_' });

    this.httpRequests = new Counter({
      name: 'document_ingestion_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'document_ingestion_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.domainEvents = new Counter({
      name: 'document_ingestion_domain_events_total',
      help: 'Total number of domain events',
      labelNames: ['event'],
      registers: [this.registry],
    });
  }

  recordHttpRequest(method: string, route: string, status: number, durationMs: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationMs / 1000);
  }

  recordEvent(event: string): void {
    this.domainEvents.inc({ event });
  }

  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
