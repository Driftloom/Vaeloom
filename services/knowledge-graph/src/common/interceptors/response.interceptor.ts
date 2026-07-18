import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { ApiResponse } from '@vaeloom/shared-types';
import { map, type Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const result = data as
          | { data: T; meta?: Record<string, unknown> }
          | T;
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          return {
            success: true,
            data: result.data,
            meta: result.meta,
          };
        }
        return { success: true, data: result as T };
      }),
    );
  }
}
