import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object') {
        const body = responseBody as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        code = (body.error as string) ?? HttpStatus[status];
        if (body.details) {
          details = body.details as Record<string, unknown>;
        }
      }

      code = HttpStatus[status] as string;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error({ err: exception }, 'Unhandled exception');
    }

    response.status(status).json({
      success: false,
      data: null,
      error: { code, message, ...(details ? { details } : {}) },
    });
  }
}
