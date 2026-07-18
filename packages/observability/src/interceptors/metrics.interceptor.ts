import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MetricsService } from '../metrics/metrics.service';

/**
 * Records HTTP request metrics for every handled request:
 *  - `http_requests_total` (counter, labels: method, route, status)
 *  - `http_request_duration_seconds` (histogram, same labels)
 *  - `active_connections` (gauge, +1 on entry / -1 on exit)
 *
 * Route is taken from the matched route path (e.g. `/memories/:id`) so metrics
 * are not exploded by raw URL parameters. When no route matched we fall back to
 * the request method + original url.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<{
      method: string;
      url: string;
      route?: { path?: string };
    }>();
    const response = ctx.getResponse<{ statusCode: number }>();

    const method = request.method;
    const start = process.hrtime.bigint();

    this.metrics.incrementActiveConnections();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, request, response?.statusCode ?? 200, start),
        error: (err: { status?: number; statusCode?: number }) =>
          this.record(method, request, err?.status ?? err?.statusCode ?? 500, start),
        complete: () => this.record(method, request, response?.statusCode ?? 200, start),
      }),
    );
  }

  private record(
    method: string,
    request: { url: string; route?: { path?: string } },
    status: number,
    start: bigint,
  ): void {
    this.metrics.decrementActiveConnections();
    const route = request.route?.path ?? request.url ?? '/';
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    this.metrics.recordHttpRequest(method, route, status, durationMs);
  }
}
