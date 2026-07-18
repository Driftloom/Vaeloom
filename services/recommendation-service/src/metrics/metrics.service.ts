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
  readonly recommendationsGenerated: Counter<string>;
  readonly feedbackRecorded: Counter<string>;
  readonly indexRebuilds: Counter<string>;
  readonly modelLatency: Histogram<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.requestCounter = new Counter({
      name: 'recommendation_service_requests_total',
      help: 'Total number of requests handled',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'recommendation_service_request_duration_seconds',
      help: 'Request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.errorCounter = new Counter({
      name: 'recommendation_service_errors_total',
      help: 'Total number of errors',
      labelNames: ['route', 'code'],
      registers: [this.registry],
    });

    this.recommendationsGenerated = new Counter({
      name: 'recommendation_service_recommendations_generated_total',
      help: 'Total number of recommendations generated',
      labelNames: ['tenant_id'],
      registers: [this.registry],
    });

    this.feedbackRecorded = new Counter({
      name: 'recommendation_service_feedback_total',
      help: 'Total number of feedback records',
      labelNames: ['tenant_id', 'useful'],
      registers: [this.registry],
    });

    this.indexRebuilds = new Counter({
      name: 'recommendation_service_index_rebuilds_total',
      help: 'Total number of preference index rebuilds',
      labelNames: ['tenant_id'],
      registers: [this.registry],
    });

    this.modelLatency = new Histogram({
      name: 'recommendation_service_model_latency_seconds',
      help: 'Latency of the personalization model call in seconds',
      labelNames: ['tenant_id'],
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
