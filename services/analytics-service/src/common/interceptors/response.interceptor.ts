import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseWrapper<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponseWrapper<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
