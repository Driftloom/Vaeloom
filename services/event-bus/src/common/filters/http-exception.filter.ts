import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ApiResponse } from '@vaeloom/shared-types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: HttpStatus[httpStatus] ?? 'INTERNAL_ERROR',
        message,
        details:
          exception instanceof HttpException
            ? (exception.getResponse() as Record<string, unknown>)?.message
            : undefined,
      },
    };

    httpAdapter.reply(ctx.getResponse(), response, httpStatus);
  }
}
