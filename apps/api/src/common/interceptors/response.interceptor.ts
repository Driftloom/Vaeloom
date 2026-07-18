import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestContextService } from '../../observability/request-context.service';

interface PaginatedMeta {
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  timestamp: string;
  requestId?: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginatedMeta;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        const meta: PaginatedMeta = {
          timestamp: new Date().toISOString(),
          requestId: this.requestContext.correlationId,
          total: 0,
          page: 0,
          pageSize: 0,
          hasNext: false,
        };

        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          const paginated = data as { data: T; meta: PaginatedMeta };
          return {
            success: true,
            data: paginated.data,
            meta: {
              ...meta,
              ...paginated.meta,
              timestamp: meta.timestamp,
              requestId: meta.requestId,
            },
          };
        }

        return { success: true, data, meta };
      }),
    );
  }
}
