import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { Request, Response } from 'express';
import { generateServiceToken } from '@vaeloom/service-auth';

interface RouteMapping {
  prefix: string;
  envKey: string;
  defaultPort: number;
}

const ROUTES: RouteMapping[] = [
  { prefix: '/api/auth', envKey: 'AUTH_SERVICE_URL', defaultPort: 3020 },
  { prefix: '/api/iam', envKey: 'IAM_SERVICE_URL', defaultPort: 3120 },
  { prefix: '/api/rbac', envKey: 'RBAC_SERVICE_URL', defaultPort: 3170 },
  { prefix: '/api/memory', envKey: 'MEMORY_STORE_URL', defaultPort: 3010 },
  { prefix: '/api/kg', envKey: 'KNOWLEDGE_GRAPH_URL', defaultPort: 3030 },
  { prefix: '/api/search', envKey: 'SEARCH_SERVICE_URL', defaultPort: 3050 },
  { prefix: '/api/agents', envKey: 'AGENT_ENGINE_URL', defaultPort: 3060 },
  { prefix: '/api/events', envKey: 'EVENT_BUS_URL', defaultPort: 3040 },
  { prefix: '/api/documents', envKey: 'DOCUMENT_INGESTION_URL', defaultPort: 3110 },
  { prefix: '/api/connectors', envKey: 'CONNECTOR_SERVICE_URL', defaultPort: 3100 },
  { prefix: '/api/integrations', envKey: 'INTEGRATION_SERVICE_URL', defaultPort: 3130 },
  { prefix: '/api/plugins', envKey: 'PLUGIN_SERVICE_URL', defaultPort: 3160 },
  { prefix: '/api/notifications', envKey: 'NOTIFICATION_SERVICE_URL', defaultPort: 3150 },
  { prefix: '/api/billing', envKey: 'BILLING_SERVICE_URL', defaultPort: 3090 },
  { prefix: '/api/analytics', envKey: 'ANALYTICS_SERVICE_URL', defaultPort: 3070 },
  { prefix: '/api/audit', envKey: 'AUDIT_SERVICE_URL', defaultPort: 3080 },
  { prefix: '/api/scheduler', envKey: 'JOB_SCHEDULER_URL', defaultPort: 3140 },
  { prefix: '/api/recommendations', envKey: 'RECOMMENDATION_SERVICE_URL', defaultPort: 3180 },
];

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30_000;

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly circuits = new Map<string, CircuitBreakerState>();

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private getCircuitState(serviceName: string): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, { failures: 0, lastFailureTime: 0, state: 'CLOSED' });
    }
    return this.circuits.get(serviceName)!;
  }

  private recordFailure(serviceName: string): void {
    const circuit = this.getCircuitState(serviceName);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuit.state = 'OPEN';
      this.logger.warn(`Circuit breaker OPEN for ${serviceName}`);
    }
  }

  private recordSuccess(serviceName: string): void {
    const circuit = this.getCircuitState(serviceName);
    circuit.failures = 0;
    circuit.state = 'CLOSED';
  }

  private isCircuitOpen(serviceName: string): boolean {
    const circuit = this.getCircuitState(serviceName);
    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime >= CIRCUIT_BREAKER_RESET_MS) {
        circuit.state = 'HALF_OPEN';
        this.logger.warn(`Circuit breaker HALF_OPEN for ${serviceName}`);
        return false;
      }
      return true;
    }
    return false;
  }

  private matchRoute(path: string): { route: RouteMapping; restPath: string } | null {
    const sorted = [...ROUTES].sort((a, b) => b.prefix.length - a.prefix.length);
    for (const route of sorted) {
      if (path.startsWith(route.prefix)) {
        return { route, restPath: path.slice(route.prefix.length) || '/' };
      }
    }
    return null;
  }

  async forward(req: Request, res: Response): Promise<void> {
    const match = this.matchRoute(req.path);
    if (!match) {
      res.status(404).json({ statusCode: 404, message: `No route matched: ${req.path}` });
      return;
    }

    const { route, restPath } = match;
    const serviceName = route.envKey.replace('_URL', '').toLowerCase();

    if (this.isCircuitOpen(serviceName)) {
      res.status(503).json({
        statusCode: 503,
        message: `Service ${serviceName} is unavailable (circuit breaker open)`,
      });
      return;
    }

    const baseUrl = this.resolveServiceUrl(route);
    const targetUrl = `${baseUrl}${restPath}`;

    const method = req.method.toLowerCase() as Method;
    const config: AxiosRequestConfig = {
      method,
      url: targetUrl,
      headers: this.buildForwardHeaders(req),
      data: ['post', 'put', 'patch'].includes(method) ? req.body : undefined,
      params: req.query,
      responseType: 'stream',
      validateStatus: () => true,
    };

    const maxRetries = this.config.get<number>('gateway.retryCount') ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(this.http.request(config));
        this.recordSuccess(serviceName);

        for (const [key, value] of Object.entries(response.headers)) {
          if (!['transfer-encoding', 'connection'].includes(key)) {
            res.setHeader(key, value as string);
          }
        }
        res.status(response.status);
        response.data.pipe(res);
        return;
      } catch (err) {
        this.recordFailure(serviceName);
        if (attempt < maxRetries) {
          this.logger.warn(`Retry ${attempt + 1}/${maxRetries} for ${targetUrl}`);
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        } else {
          this.logger.error(`Request failed after ${maxRetries + 1} attempts: ${targetUrl}`);
          res.status(502).json({
            statusCode: 502,
            message: `Bad gateway: ${serviceName} unreachable`,
          });
          return;
        }
      }
    }
  }

  private resolveServiceUrl(route: RouteMapping): string {
    const envUrl = this.config.get<string>(route.envKey);
    if (envUrl) return envUrl.replace(/\/+$/, '');
    const internalHost = route.envKey
      .replace('_URL', '')
      .toLowerCase()
      .replace(/_/g, '-');
    return `http://${internalHost}:${route.defaultPort}`;
  }

  private buildForwardHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    const forwardHeaders = ['content-type', 'content-length', 'authorization', 'x-request-id', 'x-trace-id', 'x-tenant-id'];
    for (const key of forwardHeaders) {
      const value = req.headers[key];
      if (value) headers[key] = Array.isArray(value) ? value.join(', ') : value;
    }
    const serviceAuthSecret = this.config.get<string>('serviceAuth.secret');
    if (serviceAuthSecret) {
      headers['x-service-auth'] = generateServiceToken('api-gateway', serviceAuthSecret);
    }
    return headers;
  }
}
