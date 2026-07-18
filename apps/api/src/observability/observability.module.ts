import { type MiddlewareConsumer, Global, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';

import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

/**
 * Cross-cutting observability: structured JSON logging (Docs/DevOps/Logging.md)
 * and the per-request context that carries the trace id and principal
 * (Docs/Enterprise/Multi-Tenancy.md).
 *
 * Logs are emitted as JSON to stdout with the required schema fields (level,
 * time, service, trace_id, message). Sensitive fields are redacted at the logger
 * level so tokens/passwords never reach the log store. In development
 * `LOG_FORMAT=pretty` renders human-readable lines.
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): { pinoHttp: PinoHttpOptions } => {
        const level = config.get<string>('log.level') ?? 'info';
        const format = config.get<string>('log.format') ?? 'json';

        const pinoHttp: PinoHttpOptions = {
          level,
          // `service` and a stable `trace_id` on every line (Docs/DevOps/Logging.md).
          base: { service: 'api' },
          // Reuse the request context correlation id as the log trace id.
          genReqId: (req, res) => {
            const existing = req.headers['x-request-id'];
            const id = (Array.isArray(existing) ? existing[0] : existing)?.trim();
            const value = id || (res.getHeader('x-request-id') as string | undefined);
            return value ?? '';
          },
          customProps: () => ({}),
          // Rename fields to the documented schema (level as a word, trace_id).
          formatters: {
            level: (label) => ({ level: label }),
          },
          messageKey: 'message',
          customLogLevel: (_req, res, err) => {
            if (res.statusCode >= 500 || err) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
          // Never log secrets/PII. Redact common credential-bearing paths.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["set-cookie"]',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.passwordHash',
              'req.body.token',
              'req.body.accessToken',
              'req.body.refreshToken',
              '*.password',
              '*.passwordHash',
              '*.accessToken',
              '*.refreshToken',
            ],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
          transport:
            format === 'pretty'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:standard' },
                }
              : undefined,
        };

        return { pinoHttp };
      },
    }),
  ],
  providers: [RequestContextService],
  exports: [RequestContextService, LoggerModule],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
