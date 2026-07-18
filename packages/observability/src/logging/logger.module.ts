import { Global, Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { Options as PinoHttpOptions } from 'pino-http';

import { LoggerService } from './logger.service';

export interface LoggerModuleOptions {
  /** Service name stamped onto every log line (default `vaeloom`). */
  serviceName?: string;
  /** Log level (default `info`). */
  level?: string;
  /** `json` (default) or `pretty`. */
  format?: string;
  /** Extra redaction paths; merged with the Vaeloom defaults. */
  extraRedactPaths?: string[];
}

const DEFAULT_REDACT_PATHS = [
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
];

function buildPinoOptions(options: LoggerModuleOptions): { pinoHttp: PinoHttpOptions } {
  const serviceName = options.serviceName ?? process.env.LOG_SERVICE_NAME ?? 'vaeloom';
  const level = options.level ?? process.env.LOG_LEVEL ?? 'info';
  const format = options.format ?? process.env.LOG_FORMAT ?? 'json';

  const pinoHttp: PinoHttpOptions = {
    level,
    base: { service: serviceName },
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = (Array.isArray(existing) ? existing[0] : existing)?.trim();
      const value = id || (res.getHeader('x-request-id') as string | undefined);
      return value ?? '';
    },
    customProps: () => ({}),
    formatters: {
      level: (label) => ({ level: label }),
    },
    messageKey: 'message',
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    redact: {
      paths: [...DEFAULT_REDACT_PATHS, ...(options.extraRedactPaths ?? [])],
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
}

/**
 * Standard Vaeloom structured-logging module, wrapping nestjs-pino.
 *
 * - emits JSON logs to stdout with a `service` base field
 * - redacts secret-bearing paths
 * - correlates lines via `x-request-id`
 * - exposes a `LoggerService` helper for structured field logging
 *
 * Usage: `LoggerModule.forRoot({ serviceName: 'memory-store' })` inside
 * `AppModule.imports`. Note: existing services already wire pino through their
 * own `ObservabilityModule`; import `LoggerModule` only where you want this
 * shared default config.
 */
@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    return {
      module: LoggerModule,
      imports: [PinoLoggerModule.forRoot(buildPinoOptions(options))],
      providers: [LoggerService],
      exports: [LoggerModule, LoggerService],
    };
  }
}
